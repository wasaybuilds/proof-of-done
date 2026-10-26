import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { findPassClaim } from "../claim.js";
import { classifyPath } from "../changeset/classify.js";
import { gitChangeSet } from "../changeset/git.js";
import { verify } from "../engine.js";
import { agentFeedback, humanReport } from "../feedback/format.js";
import { loadConfig } from "../policy/config.js";
import { runTests } from "../runner/run.js";
import type { Finding, RuleContext } from "../types.js";
import { readLastAssistantMessage, readUserPrompts, userAsked } from "./intent.js";

/** Fields we use from Claude Code's hook input. Everything else is ignored. */
export interface HookInput {
  hook_event_name?: string;
  session_id?: string;
  cwd?: string;
  stop_hook_active?: boolean;
  /** Session transcript (JSONL). Read locally to see what the user asked for; never sent anywhere. */
  transcript_path?: string;
  /** Stop: Claude's final message of the turn, checked for a claim that the tests pass. */
  last_assistant_message?: string;
}

export interface HookOutput {
  /** Printed to stdout. For Stop, a JSON decision; for SessionStart, stdout would enter Claude's context, so we print nothing. */
  stdout?: string;
  /** Printed to stderr, for debugging. Never blocks. */
  stderr?: string;
}

interface SessionState {
  /** The state the session started from (last commit plus uncommitted changes) — the base every Stop check compares against. */
  base: string;
  blocks: number;
  /** Findings of the last block, to tell "the agent disagrees" apart from "the agent made new changes". */
  lastBlock?: string | undefined;
}

export const MAX_BLOCKS_PER_SESSION = 3;

/**
 * Session state lives outside the project, where the agent can't edit it without the user's permission.
 * Inside the project, an agent could commit its changes and then move the recorded base to that commit.
 */
export const stateDir = (cwd: string): string =>
  join(
    process.env.PROOF_OF_DONE_STATE_DIR || join(homedir(), ".proof-of-done", "sessions"),
    createHash("sha256").update(resolve(cwd)).digest("hex").slice(0, 16),
  );

const stateFile = (cwd: string, sessionId: string): string =>
  join(stateDir(cwd), `${sessionId.replace(/[^A-Za-z0-9_-]/g, "_")}.json`);

function readState(file: string): SessionState | undefined {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as SessionState;
  } catch {
    return undefined;
  }
}

function writeState(file: string, state: SessionState): void {
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, JSON.stringify(state) + "\n");
}

function headCommit(cwd: string): string | undefined {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined; // not a git repo, or no commits yet
  }
}

const IDENTITY = {
  GIT_AUTHOR_NAME: "Proof of Done",
  GIT_AUTHOR_EMAIL: "proof-of-done@localhost",
  GIT_COMMITTER_NAME: "Proof of Done",
  GIT_COMMITTER_EMAIL: "proof-of-done@localhost",
};

/**
 * The working tree as it is now, uncommitted and untracked (not ignored) files included, as a commit on top of `head`.
 * Built in a throwaway copy of the index, so the user's index, working tree and branches are untouched.
 * Returns `head` itself when nothing is uncommitted.
 */
function snapshot(cwd: string, head: string): string {
  const git = (args: string[], env?: NodeJS.ProcessEnv): string =>
    execFileSync("git", args, { cwd, encoding: "utf8", env, stdio: ["ignore", "pipe", "ignore"] }).trim();
  const dir = mkdtempSync(join(tmpdir(), "pod-index-"));
  try {
    const index = join(dir, "index");
    const real = resolve(cwd, git(["rev-parse", "--git-path", "index"]));
    if (existsSync(real)) copyFileSync(real, index); // keeps git's stat cache, so only changed files are hashed
    const env = { ...process.env, ...IDENTITY, GIT_INDEX_FILE: index };
    git(["add", "-A"], env);
    const tree = git(["write-tree"], env);
    if (tree === git(["rev-parse", `${head}^{tree}`])) return head;
    return git(["commit-tree", "--no-gpg-sign", tree, "-p", head, "-m", "Proof of Done: session start"], env);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * SessionStart: remember where the session began, including changes that were already uncommitted, so the
 * agent isn't blamed for them. Resumed sessions keep their original base.
 */
function onSessionStart(cwd: string, sessionId: string): HookOutput {
  const file = stateFile(cwd, sessionId);
  if (readState(file)) return {};
  const head = headCommit(cwd);
  if (!head) return {};
  let base = head;
  try {
    base = snapshot(cwd, head);
  } catch {
    // fall back to the last commit: uncommitted changes then count as the session's
  }
  writeState(file, { base, blocks: 0 });
  return {};
}

/**
 * POD013 evidence: when Claude's final message says the tests pass and `.proofofdone.yml` (from the session's base)
 * configures them, re-run them. A setup problem is reported to the user, never held against Claude.
 */
async function claimEvidence(input: HookInput, cwd: string, base: string): Promise<{ evidence: Omit<RuleContext, "files">; problem?: string }> {
  const claim = findPassClaim(input.last_assistant_message ?? readLastAssistantMessage(input.transcript_path));
  if (!claim) return { evidence: {} };
  let tests;
  try {
    tests = loadConfig(cwd, base).tests;
  } catch (err) {
    return { evidence: {}, problem: `can't check that the tests pass: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (!tests) return { evidence: {} };
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  const outcome = await runTests(root, tests);
  return outcome.ok ? { evidence: { claim, testRun: outcome.run } } : { evidence: {}, problem: `couldn't check Claude's claim that the tests pass: ${outcome.reason}.` };
}

const describe = (f: Finding): string => `${f.message} (${f.file})`;
const signature = (findings: Finding[]): string =>
  findings.map((f) => `${f.ruleId}|${f.file}|${f.test ?? ""}`).sort().join("\n");

/**
 * Stop: verify the session's changes and block on FAIL — but never against the user:
 * - changes the user explicitly asked for (per their own messages in the transcript) don't block;
 * - if the agent was blocked and tries to stop again with the exact same findings, it disagrees
 *   rather than cheats, so the decision goes to the user instead of blocking until it gives in.
 */
async function onStop(input: HookInput, cwd: string, sessionId: string): Promise<HookOutput> {
  const file = stateFile(cwd, sessionId);
  // No SessionStart record (e.g. hook installed mid-session): fall back to the current commit.
  let state = readState(file);
  if (!state) {
    const head = headCommit(cwd);
    if (!head) return {};
    state = { base: head, blocks: 0 };
  }

  const { evidence, problem } = await claimEvidence(input, cwd, state.base);
  const problemNote = problem && `Proof of Done: ${problem}`;
  const result = await verify(gitChangeSet(cwd, state.base), undefined, evidence);
  const prompts = readUserPrompts(input.transcript_path);
  const asked = result.findings.filter((f) => f.severity === "block" && userAsked(f, prompts, classifyPath(f.file)));
  const blocking = result.findings.filter((f) => f.severity === "block" && !asked.includes(f));
  const askedNote = asked.length
    ? `Proof of Done: allowed ${asked.length} test change${asked.length === 1 ? "" : "s"} you asked for: ${asked.map(describe).join("; ")}.`
    : undefined;

  if (!blocking.length) {
    writeState(file, { ...state, lastBlock: undefined });
    const note = [askedNote, problemNote].filter(Boolean).join(" ");
    return note ? { stdout: JSON.stringify({ systemMessage: note }) } : {};
  }

  const sig = signature(blocking);
  const disagrees = input.stop_hook_active && state.lastBlock === sig;
  if (disagrees || state.blocks >= MAX_BLOCKS_PER_SESSION) {
    const why = disagrees
      ? "Claude was sent back once but didn't change these, so it may have a reason. Please decide"
      : `still failing after ${MAX_BLOCKS_PER_SESSION} attempts; not blocking again. Please review`;
    writeState(file, { ...state, lastBlock: undefined });
    return {
      stdout: JSON.stringify({
        systemMessage: [`Proof of Done: ${why}: ${blocking.map(describe).join("; ")}.`, askedNote, problemNote].filter(Boolean).join(" "),
      }),
      stderr: humanReport(result),
    };
  }

  writeState(file, { ...state, blocks: state.blocks + 1, lastBlock: sig });
  return {
    stdout: JSON.stringify({
      decision: "block",
      reason: `Proof of Done: ${agentFeedback(blocking)} If the user explicitly asked for this change, don't revert it: say so in your reply and stop.`,
      ...(problemNote && { systemMessage: problemNote }),
    }),
  };
}

/**
 * Entry point for `proof-of-done hook claude-code`.
 * Fails open: any error lets the agent stop normally — a verifier bug must never trap the session.
 */
export async function handleClaudeCodeHook(input: HookInput): Promise<HookOutput> {
  const cwd = input.cwd ?? process.cwd();
  const sessionId = input.session_id ?? "default";
  try {
    switch (input.hook_event_name) {
      case "SessionStart":
        return onSessionStart(cwd, sessionId);
      case "Stop":
        return await onStop(input, cwd, sessionId);
      default:
        return {};
    }
  } catch (err) {
    return { stderr: `proof-of-done: hook error, not blocking: ${err instanceof Error ? err.message : String(err)}` };
  }
}
