import { describe, expect, it } from "vitest";
import { findPassClaim } from "../src/claim.js";
import { claimMismatch } from "../src/rules/POD013-claim-mismatch.js";

describe("findPassClaim", () => {
  it.each([
    ["All tests pass.", { text: "All tests pass." }],
    ["Done! All 28 tests are passing.", { text: "All 28 tests are passing." }],
    ["I refactored the parser.\n\nThe full test suite passes now.", { text: "The full test suite passes now." }],
    ["Ran pytest: 12 passed, 0 failed.", { text: "Ran pytest: 12 passed, 0 failed." }],
    ["Tests are green.", { text: "Tests are green." }],
    ["- **All tests pass**", { text: "All tests pass" }],
    ["28/28 tests passing, no failures.", { text: "28/28 tests passing, no failures." }],
    ["The tests pass, so this is ready to merge.", { text: "The tests pass, so this is ready to merge." }],
    ["Fixed it and the tests pass.", { text: "Fixed it and the tests pass." }],
    ["Done, the test suite passes.", { text: "Done, the test suite passes." }],
    // seen in a live Claude Code run (Sonnet, 2026-10-26)
    ["I fixed the bug, and all 3 tests in `npm test` now pass.", { text: "I fixed the bug, and all 3 tests in `npm test` now pass." }],
    ["All tests in the suite pass.", { text: "All tests in the suite pass." }],
    ["All 12 tests in `python -m pytest -q` passed.", { text: "All 12 tests in `python -m pytest -q` passed." }],
    // a bare count claims only that many pass
    ["✅ 42 tests passed", { text: "✅ 42 tests passed", passing: 42 }],
    ["40 passed.", { text: "40 passed.", passing: 40 }],
  ])("claim: %j", (message, claim) => {
    expect(findPassClaim(message)).toEqual(claim);
  });

  it.each([
    "Not all tests pass yet.",
    "2 tests are still failing.",
    "12 passed, 2 failed.",
    "Once you install the dependencies, all tests should pass.",
    "Can you check whether all tests pass?",
    "Do all tests pass?",
    "I couldn't get the tests to pass.",
    "All tests pass except test_retry, which is flaky.",
    "Run `npm test` to make sure all tests pass.",
    "Tests will pass after the migration.",
    "I updated the README.",
    "```\n===== 12 passed in 0.31s =====\n```",
    "> all tests pass (quoting the issue)",
    "If the tests pass, merge it.",
    "The tests didn't pass on Windows.",
    "",
    // only some of the tests: they can pass while others fail
    "Fixed the percentage bug. The discount tests pass now.",
    "Its tests pass.",
    "The new tests pass.",
    "These tests are green.",
    "All 3 discount tests pass.",
    "All unit tests pass.",
    "All tests in `src/cart.test.ts` pass.",
    "All 3 tests in discount.test.ts pass.",
  ])("not a claim about the whole suite: %j", (message) => {
    expect(findPassClaim(message)).toBeUndefined();
  });

  it("shortens long sentences", () => {
    const claim = findPassClaim(`All tests pass ${"and everything is great ".repeat(10)}.`);
    expect(claim?.text.length).toBe(120);
    expect(claim?.text.endsWith("...")).toBe(true);
  });
});

describe("POD013 claim-mismatch", () => {
  const run = (failed: number, total = 42) => ({
    command: "npm test",
    total,
    skipped: 0,
    failed: Array.from({ length: failed }, (_, i) => ({ name: `t${i}` })),
  });
  const check = (claim: { text: string; passing?: number }, testRun: ReturnType<typeof run>) =>
    claimMismatch.check({ files: [], claim, testRun }).map((f) => f.ruleId);

  it("reports any failure when the claim is that none fail", () => {
    expect(check({ text: "All tests pass." }, run(1))).toEqual(["POD013"]);
    expect(check({ text: "All tests pass." }, run(0))).toEqual([]);
  });

  it("accepts a count claim that is true, even with other failures", () => {
    expect(check({ text: "40 tests passed", passing: 40 }, run(2))).toEqual([]);
    expect(check({ text: "42 tests passed", passing: 42 }, run(2))).toEqual(["POD013"]);
  });
});
