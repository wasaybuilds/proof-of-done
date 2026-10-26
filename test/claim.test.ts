import { describe, expect, it } from "vitest";
import { findPassClaim } from "../src/claim.js";

describe("findPassClaim", () => {
  it.each([
    ["All tests pass.", "All tests pass."],
    ["Done! All 28 tests are passing.", "All 28 tests are passing."],
    ["I refactored the parser.\n\nThe full test suite passes now.", "The full test suite passes now."],
    ["✅ 42 tests passed", "✅ 42 tests passed"],
    ["Ran pytest: 12 passed, 0 failed.", "Ran pytest: 12 passed, 0 failed."],
    ["Tests are green.", "Tests are green."],
    ["- **All unit tests pass**", "All unit tests pass"],
    ["28/28 tests passing, no failures.", "28/28 tests passing, no failures."],
    ["The tests pass, so this is ready to merge.", "The tests pass, so this is ready to merge."],
  ])("claim: %j", (message, sentence) => {
    expect(findPassClaim(message)).toBe(sentence);
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
  ])("not a claim: %j", (message) => {
    expect(findPassClaim(message)).toBeUndefined();
  });

  it("shortens long sentences", () => {
    const claim = findPassClaim(`All tests pass ${"and everything is great ".repeat(10)}.`);
    expect(claim?.length).toBe(120);
    expect(claim?.endsWith("...")).toBe(true);
  });
});
