import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gitChangeSet } from "../src/changeset/git.js";
import { verify } from "../src/engine.js";

let repo: string;
const git = (...args: string[]) =>
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], { cwd: repo, stdio: "pipe" });
const write = (path: string, content: string) => {
  mkdirSync(join(repo, path, ".."), { recursive: true });
  writeFileSync(join(repo, path), content);
};

const TWO_TESTS = `
def test_a():
    assert 1 == 1

def test_b():
    assert 2 == 2
`;

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "pod-git-"));
  git("init", "-q");
  write("tests/test_x.py", TWO_TESTS);
  write("src/app.py", "x = 1\n");
  git("add", "-A");
  git("commit", "-q", "-m", "init");
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe("gitChangeSet + verify", () => {
  it("passes when nothing changed", async () => {
    expect((await verify(gitChangeSet(repo, "HEAD"))).verdict).toBe("PASS");
  });

  it("detects an uncommitted test deletion", async () => {
    write("tests/test_x.py", "def test_a():\n    assert 1 == 1\n");
    const result = await verify(gitChangeSet(repo, "HEAD"));
    expect(result.verdict).toBe("FAIL");
    expect(result.findings.map((f) => f.ruleId)).toEqual(["POD001"]);
  });

  it("detects a committed test file deletion against an older base", async () => {
    git("rm", "-q", "tests/test_x.py");
    git("commit", "-q", "-m", "remove tests");
    const result = await verify(gitChangeSet(repo, "HEAD~1"));
    expect(result.findings).toMatchObject([{ ruleId: "POD001", message: "test file deleted (2 tests)" }]);
  });

  it("treats a renamed test file with unchanged tests as clean", async () => {
    git("mv", "tests/test_x.py", "tests/test_renamed.py");
    expect((await verify(gitChangeSet(repo, "HEAD"))).verdict).toBe("PASS");
  });

  it("includes untracked files", async () => {
    write("tests/test_new.py", "def test_new():\n    assert True\n");
    const changes = gitChangeSet(repo, "HEAD");
    expect(changes).toMatchObject([{ path: "tests/test_new.py", status: "added", kind: "test" }]);
  });

  it("throws on an unknown base ref", () => {
    expect(() => gitChangeSet(repo, "does-not-exist")).toThrow();
  });
});
