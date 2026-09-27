import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gitChangeSet } from "../changeset/git.js";
import { verify } from "../engine.js";
import { agentFeedback, humanReport } from "../feedback/format.js";
import type { Finding } from "../types.js";
import { readUserPrompts, userAsked } from "./intent.js";

/** Fields we use from Claude Code's hook input. Everything else is ignored. */
export interface HookInput {
  hook_event_name?: string;
  session_id?: string;
  cwd?: string;
  stop_hook_active?: boolean;
  /** Session transcript (JSONL). Read locally to see what the user asked for; never sent anywhere. */
  transcript_path?: string;
}

export interface HookOutput {
  /** Printed to stdout. For Stop, a JSON decision; for SessionStart, stdout would enter Claude's context, so we print nothing. */
  stdout?: string;
  /** Printed to stderr, for debugging. Never blocks. */
  stderr?: string;
}

interface SessionState {
  /** Commit the session started from — the base every Stop check compares against. */
  base: string;
  blocks: number;
  /** Findings of the last block, to tell "the agent disagrees" apart from "the agent made new changes". */
  lastBlock?: string | undefined;
}

export const MAX_BLOCKS_PER_SESSION = 3;

const stateFile = (cwd: string, sessionId: string): string =>
  join(cwd, ".proof-of-done", "sessions", `${sessionId.replace(/[^A-Za-z0-9_-]/g, "_")}.json`);

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

/** SessionStart: remember where the session began. Resumed sessions keep their original base. */
function onSessionStart(cwd: string, sessionId: string): HookOutput {
  const file = stateFile(cwd, sessionId);
  if (readState(file)) return {};
  const base = headCommit(cwd);
  if (base) writeState(file, { base, blocks: 0 });
  return {};
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

  const result = await verify(gitChangeSet(cwd, state.base));
  const prompts = readUserPrompts(input.transcript_path);
  const asked = result.findings.filter((f) => f.severity === "block" && userAsked(f, prompts));
  const blocking = result.findings.filter((f) => f.severity === "block" && !asked.includes(f));
  const askedNote = asked.length
    ? `Proof of Done: allowed ${asked.length} test change${asked.length === 1 ? "" : "s"} you asked for: ${asked.map(describe).join("; ")}.`
    : undefined;

  if (!blocking.length) {
    writeState(file, { ...state, lastBlock: undefined });
    return askedNote ? { stdout: JSON.stringify({ systemMessage: askedNote }) } : {};
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
        systemMessage: [`Proof of Done: ${why}: ${blocking.map(describe).join("; ")}.`, askedNote].filter(Boolean).join(" "),
      }),
      stderr: humanReport(result),
    };
  }

  writeState(file, { ...state, blocks: state.blocks + 1, lastBlock: sig });
  return {
    stdout: JSON.stringify({
      decision: "block",
      reason: `Proof of Done: ${agentFeedback(blocking)} If the user explicitly asked for this change, don't revert it: say so in your reply and stop.`,
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
