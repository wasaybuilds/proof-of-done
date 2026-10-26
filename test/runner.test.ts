import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig, parseConfig } from "../src/policy/config.js";
import { runTests } from "../src/runner/run.js";

let repo: string;
const git = (...args: string[]) =>
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], { cwd: repo, stdio: "pipe" });
const write = (path: string, content: string) => {
  mkdirSync(join(repo, path, ".."), { recursive: true });
  writeFileSync(join(repo, path), content);
};

/** A stand-in test runner: writes a JUnit report with the given outcome to the path in argv[2]. */
const FAKE_RUNNER = `
import { writeFileSync } from "node:fs";
const [out, outcome] = process.argv.slice(2);
if (outcome === "hang") setInterval(() => {}, 1000);
else if (outcome !== "no-report") {
  const failure = outcome === "fail" ? '<failure message="assert 1 == 2"/>' : "";
  writeFileSync(out, '<testsuite><testcase classname="tests.test_x" name="test_a"/><testcase classname="tests.test_x" name="test_b">' + failure + '</testcase></testsuite>');
}
`;

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "pod-run-"));
  git("init", "-q");
  write("run-tests.mjs", FAKE_RUNNER);
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe("parseConfig", () => {
  it("reads the tests section, with a default timeout", () => {
    expect(parseConfig("version: 0\ntests:\n  command: pytest --junitxml={junit}\n")).toEqual({
      tests: { command: "pytest --junitxml={junit}", timeoutSeconds: 300 },
    });
    expect(parseConfig("tests:\n  command: npx jest\n  junitPath: reports/junit.xml\n  timeoutSeconds: 60\n")).toEqual({
      tests: { command: "npx jest", junitPath: "reports/junit.xml", timeoutSeconds: 60 },
    });
  });

  it("treats an empty file or one without tests as no tests", () => {
    expect(parseConfig("")).toEqual({});
    expect(parseConfig("version: 0\nrules:\n  POD004: off\n")).toEqual({});
  });

  it.each([
    ["version: 2\n", /unsupported version/],
    ["- a\n- b\n", /mapping at the top level/],
    ["tests: npm test\n", /tests: expected a mapping/],
    ["tests:\n  command: npm test\n", /\{junit\}/],
    ["tests:\n  command: pytest --junitxml={junit}\n  timeoutSeconds: 9999\n", /timeoutSeconds/],
  ])("rejects %j", (text, message) => {
    expect(() => parseConfig(text)).toThrow(message);
  });
});

describe("loadConfig", () => {
  it("reads the config from the base commit, not the working tree", () => {
    write(".proofofdone.yml", "tests:\n  command: node run-tests.mjs {junit} fail\n");
    git("add", "-A");
    git("commit", "-q", "-m", "init");
    write(".proofofdone.yml", "tests:\n  command: node run-tests.mjs {junit} pass\n"); // the agent's edit
    expect(loadConfig(repo, "HEAD").tests?.command).toBe("node run-tests.mjs {junit} fail");
  });

  it("returns no config when the base has none, even if the working tree does", () => {
    write("README.md", "x\n");
    git("add", "-A");
    git("commit", "-q", "-m", "init");
    write(".proofofdone.yml", "tests:\n  command: node run-tests.mjs {junit} pass\n");
    expect(loadConfig(repo, "HEAD")).toEqual({});
  });

  it("names the file when it is invalid", () => {
    write(".proofofdone.yml", "tests: [1, 2]\n");
    git("add", "-A");
    git("commit", "-q", "-m", "init");
    expect(() => loadConfig(repo, "HEAD")).toThrow(/\.proofofdone\.yml: tests: expected a mapping/);
  });
});

describe("runTests", () => {
  const run = (outcome: string, extra: object = {}) =>
    runTests(repo, { command: `node run-tests.mjs {junit} ${outcome}`, timeoutSeconds: 30, ...extra });

  it("reads failures from the JUnit report", async () => {
    expect(await run("fail")).toEqual({
      ok: true,
      run: { command: "node run-tests.mjs {junit} fail", total: 2, skipped: 0, failed: [{ name: "test_b", file: "tests.test_x" }] },
    });
  });

  it("reports a passing run", async () => {
    expect(await run("pass")).toMatchObject({ ok: true, run: { total: 2, failed: [] } });
  });

  it("can't verify anything without a report", async () => {
    expect(await run("no-report")).toMatchObject({ ok: false, reason: expect.stringContaining("no JUnit report") });
  });

  it("gives up after the timeout and stops the test runner", async () => {
    expect(await runTests(repo, { command: "node run-tests.mjs {junit} hang", timeoutSeconds: 1 })).toMatchObject({
      ok: false,
      reason: expect.stringContaining("timed out"),
    });
  });

  it("with junitPath, ignores a report planted before the run and cleans up after", async () => {
    write("reports/junit.xml", '<testsuite><testcase name="planted"/></testsuite>');
    const outcome = await runTests(repo, { command: "node run-tests.mjs reports/junit.xml no-report", junitPath: "reports/junit.xml", timeoutSeconds: 30 });
    expect(outcome).toMatchObject({ ok: false, reason: expect.stringContaining("no JUnit report") });
    expect(await runTests(repo, { command: "node run-tests.mjs reports/junit.xml fail", junitPath: "reports/junit.xml", timeoutSeconds: 30 })).toMatchObject({
      ok: true,
      run: { total: 2 },
    });
    expect(existsSync(join(repo, "reports", "junit.xml"))).toBe(false);
  });
});
