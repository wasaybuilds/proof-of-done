import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleClaudeCodeHook, MAX_BLOCKS_PER_SESSION } from "../src/adapters/claude-code.js";
import { defaultCommand, installClaudeCode, settingsPath, uninstallClaudeCode } from "../src/adapters/install.js";

let repo: string;
const git = (...args: string[]) =>
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], { cwd: repo, stdio: "pipe" });
const write = (path: string, content: string) => {
  mkdirSync(join(repo, path, ".."), { recursive: true });
  writeFileSync(join(repo, path), content);
};

const TWO_TESTS = "def test_a():\n    assert 1 == 1\n\ndef test_b():\n    assert 2 == 2\n";
const ONE_TEST = "def test_a():\n    assert 1 == 1\n";

const start = () => handleClaudeCodeHook({ hook_event_name: "SessionStart", session_id: "s1", cwd: repo });
const stop = (active = false) => handleClaudeCodeHook({ hook_event_name: "Stop", session_id: "s1", cwd: repo, stop_hook_active: active });
const decision = (out: { stdout?: string }) => (out.stdout ? (JSON.parse(out.stdout) as Record<string, string>) : undefined);

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "pod-cc-"));
  git("init", "-q");
  write("tests/test_x.py", TWO_TESTS);
  git("add", "-A");
  git("commit", "-q", "-m", "init");
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe("Claude Code hook", () => {
  it("SessionStart prints nothing (stdout would cost context tokens) and records the base", async () => {
    expect(await start()).toEqual({});
    expect(existsSync(join(repo, ".proof-of-done", "sessions", "s1.json"))).toBe(true);
  });

  it("lets the agent stop when nothing was tampered with", async () => {
    await start();
    write("src/app.py", "x = 1\n");
    expect(await stop()).toEqual({});
  });

  it("blocks the stop and tells the agent what to fix when a test was deleted", async () => {
    await start();
    write("tests/test_x.py", ONE_TEST);
    const out = decision(await stop());
    expect(out?.decision).toBe("block");
    expect(out?.reason).toContain('deleted test "test_b"');
  });

  it("compares against the session start, so a commit made during the session doesn't hide the deletion", async () => {
    await start();
    write("tests/test_x.py", ONE_TEST);
    git("commit", "-qam", "agent commits its cheat");
    expect(decision(await stop())?.decision).toBe("block");
  });

  it(`stops blocking after ${MAX_BLOCKS_PER_SESSION} attempts and tells the user instead`, async () => {
    await start();
    write("tests/test_x.py", ONE_TEST);
    for (let i = 0; i < MAX_BLOCKS_PER_SESSION; i++) expect(decision(await stop(i > 0))?.decision).toBe("block");
    const last = decision(await stop(true));
    expect(last?.decision).toBeUndefined();
    expect(last?.systemMessage).toContain("not blocking again");
  });

  it("works without a SessionStart record (hook installed mid-session)", async () => {
    write("tests/test_x.py", ONE_TEST);
    expect(decision(await stop())?.decision).toBe("block");
  });

  it("does nothing outside a git repository", async () => {
    const plain = mkdtempSync(join(tmpdir(), "pod-nogit-"));
    try {
      expect(await handleClaudeCodeHook({ hook_event_name: "Stop", session_id: "s1", cwd: plain })).toEqual({});
    } finally {
      rmSync(plain, { recursive: true, force: true });
    }
  });

  it("ignores other hook events", async () => {
    expect(await handleClaudeCodeHook({ hook_event_name: "PreToolUse", cwd: repo })).toEqual({});
  });
});

describe("install / uninstall", () => {
  const cmd = 'node "/opt/pod/dist/cli/index.js" hook claude-code';

  it("writes SessionStart and Stop hooks and gitignores session state", () => {
    const file = installClaudeCode(repo, cmd, "local");
    expect(file).toBe(settingsPath(repo, "local"));
    const settings = JSON.parse(readFileSync(file, "utf8"));
    for (const event of ["SessionStart", "Stop"]) {
      expect(settings.hooks[event]).toEqual([{ hooks: [{ type: "command", command: cmd, timeout: 60 }] }]);
    }
    expect(readFileSync(join(repo, ".gitignore"), "utf8")).toContain(".proof-of-done/");
  });

  it("keeps the user's other settings and hooks, and is idempotent", () => {
    const file = settingsPath(repo, "project");
    write(".claude/settings.json", JSON.stringify({
      model: "opus",
      hooks: { Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] },
    }));
    installClaudeCode(repo, cmd, "project");
    installClaudeCode(repo, cmd, "project");
    const settings = JSON.parse(readFileSync(file, "utf8"));
    expect(settings.model).toBe("opus");
    expect(settings.hooks.Stop).toHaveLength(2);
    expect(settings.hooks.Stop[0].hooks[0].command).toBe("echo mine");
    expect(settings.hooks.SessionStart).toHaveLength(1);
  });

  it("uninstall removes only our hooks", () => {
    write(".claude/settings.json", JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] } }));
    installClaudeCode(repo, cmd, "project");
    expect(uninstallClaudeCode(repo)).toEqual([settingsPath(repo, "project")]);
    const settings = JSON.parse(readFileSync(settingsPath(repo, "project"), "utf8"));
    expect(settings.hooks).toEqual({ Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] });
  });

  it("uses npx when installed as a dependency, an absolute local path otherwise", () => {
    expect(defaultCommand("/app/node_modules/proof-of-done/dist/cli/index.js")).toEqual({
      command: "npx --no-install proof-of-done hook claude-code",
      scope: "project",
    });
    expect(defaultCommand("C:\\tools\\proof-of-done\\dist\\cli\\index.js")).toMatchObject({ scope: "local" });
  });
});
