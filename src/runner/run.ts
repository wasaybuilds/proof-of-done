import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { TestsConfig } from "../policy/config.js";
import type { TestRun } from "../types.js";
import { parseJUnit } from "./junit.js";

export type RunOutcome = { ok: true; run: TestRun } | { ok: false; reason: string };

const windows = process.platform === "win32";

/** Kill the command and everything it started: killing only the shell would leave the test runner running. */
function killTree(pid: number | undefined): void {
  if (pid === undefined) return;
  try {
    if (windows) spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    else process.kill(-pid, "SIGKILL"); // the command runs in its own process group
  } catch {
    // already gone
  }
}

type Exit = { code: number | null; timedOut: boolean; error?: Error };

function run(command: string, cwd: string, env: NodeJS.ProcessEnv, timeoutMs: number): Promise<Exit> {
  return new Promise((done) => {
    const child = spawn(command, { cwd, env, shell: true, stdio: "ignore", detached: !windows, windowsHide: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      done({ code: null, timedOut, error });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      done({ code, timedOut });
    });
  });
}

/**
 * Runs the project's test command in `root` and reads the result from its JUnit XML report.
 * Console output is discarded, never parsed: an agent can print anything, but it can't edit a report
 * that doesn't exist yet. `{junit}` in the command becomes a fresh path outside the project.
 */
export async function runTests(root: string, tests: TestsConfig): Promise<RunOutcome> {
  const dir = mkdtempSync(join(tmpdir(), "pod-tests-"));
  try {
    const own = tests.command.includes("{junit}");
    const junit = own ? join(dir, "junit.xml") : resolve(root, tests.junitPath ?? "junit.xml");
    rmSync(junit, { force: true }); // a stale or planted report must not count
    const command = tests.command.replaceAll("{junit}", `"${junit}"`);
    const exit = await run(command, root, { ...process.env, PROOF_OF_DONE_JUNIT: junit }, tests.timeoutSeconds * 1000);
    if (exit.timedOut) return { ok: false, reason: `the test command timed out after ${tests.timeoutSeconds} s` };
    if (exit.error) return { ok: false, reason: `the test command could not start: ${exit.error.message}` };
    if (!existsSync(junit)) return { ok: false, reason: `the test command wrote no JUnit report (exit code ${exit.code ?? "none"})` };
    const report = parseJUnit(readFileSync(junit, "utf8"));
    if (!own) rmSync(junit, { force: true });
    if (report.total === 0) return { ok: false, reason: "the JUnit report contains no tests" };
    return { ok: true, run: { command: tests.command, ...report } };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
