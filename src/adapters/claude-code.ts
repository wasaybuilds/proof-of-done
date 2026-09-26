import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gitChangeSet } from "../changeset/git.js";
import { verify } from "../engine.js";
import { agentFeedback, humanReport } from "../feedback/format.js";

/** Fields we use from Claude Code's hook input. Everything else is ignored. */
export interface HookInput {
  hook_event_name?: string;
  session_id?: string;
  cwd?: string;
  stop_hook_active?: boolean;
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

/** Stop: verify the session's changes; block the stop on FAIL, up to MAX_BLOCKS_PER_SESSION times. */
async function onStop(cwd: string, sessionId: string): Promise<HookOutput> {
  const file = stateFile(cwd, sessionId);
  // No SessionStart record (e.g. hook installed mid-session): fall back to the current commit.
  let state = readState(file);
  if (!state) {
    const head = headCommit(cwd);
    if (!head) return {};
    state = { base: head, blocks: 0 };
  }

  const result = await verify(gitChangeSet(cwd, state.base));
  if (result.verdict !== "FAIL") return {};

  if (state.blocks >= MAX_BLOCKS_PER_SESSION) {
    return {
      stdout: JSON.stringify({
        systemMessage: `Proof of Done: still failing after ${MAX_BLOCKS_PER_SESSION} attempts; not blocking again. Review the changes yourself.`,
      }),
      stderr: humanReport(result),
    };
  }

  writeState(file, { ...state, blocks: state.blocks + 1 });
  return {
    stdout: JSON.stringify({ decision: "block", reason: `Proof of Done: ${agentFeedback(result.findings)}` }),
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
        return await onStop(cwd, sessionId);
      default:
        return {};
    }
  } catch (err) {
    return { stderr: `proof-of-done: hook error, not blocking: ${err instanceof Error ? err.message : String(err)}` };
  }
}
