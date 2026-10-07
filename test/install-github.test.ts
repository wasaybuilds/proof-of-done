import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installGithub, isValidOwner, WORKFLOW, WORKFLOW_PATH } from "../src/adapters/github.js";

let repo: string;
beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "pod-gh-"));
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe("installGithub", () => {
  it("writes the workflow and, without owners, leaves CODEOWNERS alone", () => {
    const result = installGithub(repo);
    expect(result.workflow.created).toBe(true);
    expect(readFileSync(join(repo, WORKFLOW_PATH), "utf8")).toBe(WORKFLOW);
    expect(result.codeowners).toBeUndefined();
  });

  it("never overwrites an existing workflow", () => {
    mkdirSync(join(repo, ".github", "workflows"), { recursive: true });
    writeFileSync(join(repo, WORKFLOW_PATH), "custom\n");
    expect(installGithub(repo).workflow.created).toBe(false);
    expect(readFileSync(join(repo, WORKFLOW_PATH), "utf8")).toBe("custom\n");
  });

  it("creates .github/CODEOWNERS covering the checker", () => {
    const result = installGithub(repo, ["@alice", "@acme/platform"]);
    expect(result.codeowners?.added).toEqual(["/.github/", "/.claude/", "/.proofofdone.yml"]);
    const text = readFileSync(join(repo, ".github", "CODEOWNERS"), "utf8");
    expect(text).toContain("/.github/ @alice @acme/platform\n");
    expect(text).toContain("/.claude/ @alice @acme/platform\n");
    expect(text).toContain("/.proofofdone.yml @alice @acme/platform\n");
  });

  it("appends to an existing root CODEOWNERS at the end (last match wins), keeps existing owners, and protects the file itself", () => {
    writeFileSync(join(repo, "CODEOWNERS"), "/.github/ @sec-team\n* @bob");
    const result = installGithub(repo, ["@alice"]);
    expect(result.codeowners?.path).toBe(join(repo, "CODEOWNERS"));
    expect(result.codeowners?.added).toEqual(["/.github/", "/.claude/", "/.proofofdone.yml", "/CODEOWNERS"]);
    const lines = readFileSync(join(repo, "CODEOWNERS"), "utf8").trim().split("\n");
    expect(lines.slice(0, 2)).toEqual(["/.github/ @sec-team", "* @bob"]);
    // after "* @bob", so these are the lines GitHub actually applies
    expect(lines.slice(-4)).toEqual(["/.github/ @sec-team @alice", "/.claude/ @alice", "/.proofofdone.yml @alice", "/CODEOWNERS @alice"]);
  });

  it("does not add the file itself when it lives in .github/ (covered by /.github/)", () => {
    const result = installGithub(repo, ["@alice"]);
    expect(result.codeowners?.added).not.toContain("/.github/CODEOWNERS");
  });

  it("re-adds the block when a new owner is requested", () => {
    installGithub(repo, ["@alice"]);
    const again = installGithub(repo, ["@alice", "@carol"]);
    expect(again.codeowners?.added).toHaveLength(3);
    const lines = readFileSync(join(repo, ".github", "CODEOWNERS"), "utf8").trim().split("\n");
    expect(lines.slice(-3)).toEqual(["/.github/ @alice @carol", "/.claude/ @alice @carol", "/.proofofdone.yml @alice @carol"]);
  });

  it("is idempotent", () => {
    installGithub(repo, ["@alice"]);
    const again = installGithub(repo, ["@alice"]);
    expect(again.codeowners?.added).toEqual([]);
    expect(readFileSync(join(repo, ".github", "CODEOWNERS"), "utf8").match(/Proof of Done/g)).toHaveLength(1);
  });

  it("rejects owners that aren't users, teams or emails", () => {
    expect(() => installGithub(repo, ["alice"])).toThrow(/not a GitHub user/);
    expect(isValidOwner("@alice")).toBe(true);
    expect(isValidOwner("@acme/platform")).toBe(true);
    expect(isValidOwner("dev@example.com")).toBe(true);
  });
});
