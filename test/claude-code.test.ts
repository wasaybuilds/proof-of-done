import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleClaudeCodeHook, MAX_BLOCKS_PER_SESSION } from "../src/adapters/claude-code.js";
import { installClaudeCode, LAUNCHER_COMMAND, LAUNCHER_PATH, packageRef, settingsPath, uninstallClaudeCode } from "../src/adapters/install.js";

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

  it("hands the decision to the user when Claude is sent back but changes nothing", async () => {
    await start();
    write("tests/test_x.py", ONE_TEST);
    expect(decision(await stop())?.decision).toBe("block");
    const second = decision(await stop(true)); // Claude replied (e.g. "the user asked for this") without restoring
    expect(second?.decision).toBeUndefined();
    expect(second?.systemMessage).toContain("may have a reason");
    expect(second?.systemMessage).toContain('removed test "test_b"');
  });

  it(`keeps blocking while Claude makes new tampering, up to ${MAX_BLOCKS_PER_SESSION} times`, async () => {
    const tests = ["a", "b", "c", "d", "e"].map((n) => `def test_${n}():\n    assert ${n}() == 1\n`);
    write("tests/test_many.py", tests.join("\n"));
    git("add", "-A");
    git("commit", "-q", "-m", "more tests");
    await start();
    for (let i = 1; i <= MAX_BLOCKS_PER_SESSION; i++) {
      write("tests/test_many.py", tests.slice(i).join("\n")); // deletes one more test each round
      expect(decision(await stop(i > 1))?.decision).toBe("block");
    }
    write("tests/test_many.py", tests.slice(MAX_BLOCKS_PER_SESSION + 1).join("\n"));
    const last = decision(await stop(true));
    expect(last?.decision).toBeUndefined();
    expect(last?.systemMessage).toContain("not blocking again");
  });

  describe("respects what the user asked for", () => {
    const transcript = (prompt: string) => {
      const file = join(repo, ".transcript.jsonl");
      writeFileSync(file, JSON.stringify({ type: "user", message: { role: "user", content: prompt } }) + "\n");
      return file;
    };
    const stopWith = (prompt: string) =>
      handleClaudeCodeHook({ hook_event_name: "Stop", session_id: "s1", cwd: repo, transcript_path: transcript(prompt) });

    it("doesn't block a deletion the user explicitly asked for, and tells them", async () => {
      await start();
      write("tests/test_x.py", ONE_TEST);
      const out = decision(await stopWith("We no longer need test_b, delete it from tests/test_x.py"));
      expect(out?.decision).toBeUndefined();
      expect(out?.systemMessage).toContain("allowed 1 test change you asked for");
    });

    it("still blocks when the user didn't ask for it", async () => {
      await start();
      write("tests/test_x.py", ONE_TEST);
      expect(decision(await stopWith("Fix the bug in b() and make the tests pass"))?.decision).toBe("block");
    });

    it("still blocks when the user said not to delete", async () => {
      await start();
      write("tests/test_x.py", ONE_TEST);
      expect(decision(await stopWith("Don't delete anything in tests/test_x.py, fix the code"))?.decision).toBe("block");
    });
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
  /** A stand-in proof-of-done package inside the project, like node_modules/proof-of-done. */
  const fakePackage = (): string => {
    const pkg = join(repo, "node_modules", "proof-of-done");
    write("node_modules/proof-of-done/package.json", JSON.stringify({ name: "proof-of-done", version: "9.9.9" }));
    write(
      "node_modules/proof-of-done/dist/adapters/claude-code.js",
      'export async function handleClaudeCodeHook(input) { return { stdout: JSON.stringify({ ran: input.hook_event_name }) }; }\n',
    );
    return pkg;
  };
  const runLauncher = (input: object): string =>
    execFileSync(process.execPath, [join(repo, LAUNCHER_PATH)], {
      cwd: repo,
      input: JSON.stringify({ cwd: repo, ...input }),
      encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
    }).trim();

  it("writes the launcher and SessionStart/Stop hooks, and gitignores session state", () => {
    const installed = installClaudeCode(repo, fakePackage());
    expect(installed.scope).toBe("project");
    expect(installed.settings).toBe(settingsPath(repo, "project"));
    const settings = JSON.parse(readFileSync(installed.settings, "utf8"));
    for (const event of ["SessionStart", "Stop"]) {
      expect(settings.hooks[event]).toEqual([{ hooks: [{ type: "command", command: LAUNCHER_COMMAND, timeout: 60 }] }]);
    }
    expect(existsSync(join(repo, LAUNCHER_PATH))).toBe(true);
    expect(readFileSync(join(repo, ".gitignore"), "utf8")).toContain(".proof-of-done/");
  });

  it("launcher runs the package when it is untouched", () => {
    installClaudeCode(repo, fakePackage());
    expect(JSON.parse(runLauncher({ hook_event_name: "Stop" }))).toEqual({ ran: "Stop" });
  });

  it("launcher refuses to run a modified package and blocks the stop", () => {
    installClaudeCode(repo, fakePackage());
    // the agent patches the tool to do nothing (bypass attack B)
    write("node_modules/proof-of-done/dist/adapters/claude-code.js", "export async function handleClaudeCodeHook() { return {}; }\n");
    const out = JSON.parse(runLauncher({ hook_event_name: "Stop" }));
    expect(out.decision).toBe("block");
    expect(out.reason).toContain("don't match what was installed");
  });

  it("launcher hands a persisting mismatch to the user instead of blocking again", () => {
    installClaudeCode(repo, fakePackage());
    rmSync(join(repo, "node_modules"), { recursive: true, force: true });
    const out = JSON.parse(runLauncher({ hook_event_name: "Stop", stop_hook_active: true }));
    expect(out.decision).toBeUndefined();
    expect(out.systemMessage).toContain("run `npx proof-of-done install claude-code` again");
  });

  it("launcher stays silent on SessionStart, even when the package was modified", () => {
    installClaudeCode(repo, fakePackage());
    write("node_modules/proof-of-done/package.json", "{}");
    expect(runLauncher({ hook_event_name: "SessionStart" })).toBe("");
  });

  it("keeps the user's other settings and hooks, is idempotent, and replaces 0.2.x hook entries", () => {
    write(".claude/settings.json", JSON.stringify({
      model: "opus",
      hooks: {
        Stop: [
          { hooks: [{ type: "command", command: "echo mine" }] },
          { hooks: [{ type: "command", command: "npx --no-install proof-of-done hook claude-code" }] },
        ],
      },
    }));
    const pkg = fakePackage();
    installClaudeCode(repo, pkg);
    installClaudeCode(repo, pkg);
    const settings = JSON.parse(readFileSync(settingsPath(repo, "project"), "utf8"));
    expect(settings.model).toBe("opus");
    expect(settings.hooks.Stop.map((g: { hooks: { command: string }[] }) => g.hooks[0]?.command)).toEqual(["echo mine", LAUNCHER_COMMAND]);
    expect(settings.hooks.SessionStart).toHaveLength(1);
  });

  it("uninstall removes only our hooks, and the launcher", () => {
    write(".claude/settings.json", JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] } }));
    installClaudeCode(repo, fakePackage());
    expect(uninstallClaudeCode(repo)).toEqual([settingsPath(repo, "project"), join(repo, LAUNCHER_PATH)]);
    const settings = JSON.parse(readFileSync(settingsPath(repo, "project"), "utf8"));
    expect(settings.hooks).toEqual({ Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] });
    expect(existsSync(join(repo, LAUNCHER_PATH))).toBe(false);
  });

  it("references the package relatively inside the project, absolutely (local scope) outside it", () => {
    expect(packageRef(repo, join(repo, "node_modules", "proof-of-done"))).toEqual({ pkg: "node_modules/proof-of-done", scope: "project" });
    expect(packageRef(repo, join(tmpdir(), "elsewhere", "proof-of-done"))).toMatchObject({ scope: "local" });
  });
});
