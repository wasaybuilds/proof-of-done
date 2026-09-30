import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readUserPrompts, userAsked } from "../src/adapters/intent.js";
import type { Finding } from "../src/types.js";

const deleted: Finding = {
  ruleId: "POD001",
  severity: "block",
  file: "src/discount.test.ts",
  test: "applyDiscount > applies a percentage code",
  message: "",
  agentHint: "",
};

describe("userAsked", () => {
  it.each([
    // the two real prompts from the live Claude Code test
    "We're dropping support for percentage discount codes. Remove the percentage branch from applyDiscount in src/discount.ts and delete its test in src/discount.test.ts.",
    "Run npm test. One test is failing. Don't fix the code. Just delete that failing test so the suite is green.",
    "remove the percentage code test",
    "Please get rid of discount.test.ts",
    "skip the flaky test for now",
  ])("approves: %s", (prompt) => {
    expect(userAsked(deleted, [prompt])).toBe(true);
  });

  it.each([
    "Make the tests pass.",
    "Fix the failing test. Don't delete it.",
    "Do not remove any tests, fix the percentage bug instead.",
    "Remove the console.log and fix the failing test.",
    "Never delete the percentage test.",
    "The percentage test is failing, can you look?",
  ])("does not approve: %s", (prompt) => {
    expect(userAsked(deleted, [prompt])).toBe(false);
  });

  describe("guardrail and CI changes (POD008)", () => {
    const ci: Finding = { ruleId: "POD008", severity: "block", file: ".github/workflows/test.yml", message: "", agentHint: "" };
    const hooks: Finding = { ...ci, file: ".claude/settings.json" };

    it.each([
      ["Update the CI workflow to run on Node 22", ci, "ci"],
      ["please edit test.yml so it caches pnpm", ci, "ci"],
      ["Remove the Proof of Done hooks from .claude/settings.json", hooks, "agent-config"],
    ] as const)("approves: %s", (prompt, finding, kind) => {
      expect(userAsked(finding, [prompt], kind)).toBe(true);
    });

    it.each([
      ["Just delete that failing test so the suite is green", ci, "ci"],
      ["Make the tests pass, don't touch the CI workflow", ci, "ci"],
      ["Fix the failing test", hooks, "agent-config"],
    ] as const)("does not approve: %s", (prompt, finding, kind) => {
      expect(userAsked(finding, [prompt], kind)).toBe(false);
    });
  });

  it("never approves rules the user can't reasonably ask for", () => {
    expect(userAsked({ ...deleted, ruleId: "POD005" }, ["delete that failing test"])).toBe(false);
  });
});

describe("readUserPrompts", () => {
  it("reads only the user's own messages, not tool results or hook feedback", () => {
    const dir = mkdtempSync(join(tmpdir(), "pod-transcript-"));
    try {
      const file = join(dir, "t.jsonl");
      const lines = [
        { type: "user", message: { role: "user", content: "delete its test in src/discount.test.ts" } },
        { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "delete everything" }] } },
        { type: "user", message: { role: "user", content: [{ type: "tool_result", content: "remove the percentage test" }] } },
        { type: "user", message: { role: "user", content: "Stop hook feedback:\nProof of Done: remove the test" } },
        { type: "user", isMeta: true, message: { role: "user", content: "meta: remove the test" } },
        { type: "user", message: { role: "user", content: [{ type: "text", text: "and skip the flaky one" }] } },
      ];
      writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n") + "\nnot json\n");
      expect(readUserPrompts(file)).toEqual(["delete its test in src/discount.test.ts", "and skip the flaky one"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns nothing for a missing transcript", () => {
    expect(readUserPrompts(undefined)).toEqual([]);
    expect(readUserPrompts("/does/not/exist.jsonl")).toEqual([]);
  });
});
