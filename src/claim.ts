import type { Claim } from "./types.js";

// The project's test command, e.g. in "all 3 tests in `npm test` pass".
const TEST_COMMAND =
  /^((npx|pnpm|yarn|bun|uv run|poetry run|python3? -m) |npm (run )?)?(test|tests|pytest|vitest|jest|mocha|go test|cargo test|mvn test|gradle test|dotnet test|rspec|phpunit)\b/;
// "<subject> pass": "tests pass", "tests are passing", "test suite passes", "tests are green", and the same with
// the whole suite as the place: "tests in testcmd pass" (a quoted test command), "tests in the suite pass".
const SUBJECT_VERB =
  /\b(test suite|test run|tests)( (in|from|across) (the )?(testcmd|suite|test suite|project|repo|codebase))?( (are|is|now|all|still))* (pass(es|ed|ing)?|green|succeed(s|ed)?)\b/g;
// Claims without that subject: "all 28 pass", "12 passed".
const ALL_N_PASS = /\ball \d+ (are |now )*pass(ed|ing)?\b/;
const N_PASSED = /\b(\d+) passed\b/;

// Words that can stand before the subject and keep it the whole suite: "all of the 28 tests", "the full test suite".
const WHOLE_SUITE_MODIFIERS = new Set(["all", "of", "the", "full", "whole", "entire"]);
// Words that can end the previous clause right before the subject: "fixed it and the tests pass".
const CONNECTORS = new Set(["and", "so", "now", "then", "that", "also", "yes", "done", "great"]);

// Anything that makes a sentence something other than a plain statement that the tests pass now:
// negations, failures, conditions, plans and hopes, partial claims.
const NOT_A_CLAIM =
  /\b(not|no longer|never|cannot|can't|couldn't|won't|wouldn't|don't|doesn't|didn't|isn't|aren't|wasn't|weren't|haven't|hasn't|fail(s|ed|ing|ures?)?|errors?|broken|until|unless|if|once|when|whether|before|should|will|would|could|might|may|must|needs?|try|trying|expect|hopefully|make|making|get|getting|ensure|except|excluding|apart from|other than|besides)\b/;

// "0 failed", "no failures": a failure word that reports zero failures.
const ZERO_FAILURES = /\b(0|no|zero) (failed|failures?|failing|errors?)\b|\bwithout (any )?(failures?|errors?)\b/g;

/**
 * Is the subject ending at `end` the whole suite? "All 28 tests", "the tests", "tests" are; "the discount tests",
 * "its tests", "the new tests" are only some of them, which can pass while other tests fail.
 * Returns the claimed count ("28 tests"), or null when the subject is scoped.
 */
function wholeSuite(before: string): { all: boolean; count?: number } | null {
  const words = before.trim().split(" ").filter(Boolean);
  let all = false;
  let count: number | undefined;
  for (let w = words.pop(); w !== undefined; w = words.pop()) {
    const n = /^(\d+)(\/\d+)?$/.exec(w);
    if (n) count = Number(n[1]);
    else if (WHOLE_SUITE_MODIFIERS.has(w)) all ||= w === "all";
    else return CONNECTORS.has(w) || /[^\w']$/.test(w) ? { all, ...(count !== undefined && { count }) } : null;
  }
  return { all, ...(count !== undefined && { count }) };
}

/** Code blocks, quotes and pasted output aren't the agent's own statement. */
function prose(message: string): string {
  return message.replace(/```[\s\S]*?(```|$)/g, "\n").replace(/^\s*>.*$/gm, "");
}

/** The sentence as analysed: lower case, no emphasis, inline code dropped except a test command ("testcmd"). */
function normalize(sentence: string): string {
  return sentence
    .replace(/`([^`\n]*)`/g, (_, code: string) => (TEST_COMMAND.test(code.trim().toLowerCase()) ? " testcmd " : " "))
    .toLowerCase()
    .replace(/[*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The claim a sentence makes about the whole test suite, if any. */
function claimIn(text: string): Omit<Claim, "text"> | undefined {
  const zeroFailures = ZERO_FAILURES.test(text);
  ZERO_FAILURES.lastIndex = 0;
  if (NOT_A_CLAIM.test(text.replace(ZERO_FAILURES, ""))) return undefined;
  // Saying "0 failed" or "all" claims there are no failures; a bare count ("40 tests passed") only claims that many pass.
  const scope = (all: boolean, count: number | undefined) => (all || zeroFailures || count === undefined ? {} : { passing: count });

  for (const m of text.matchAll(SUBJECT_VERB)) {
    const subject = wholeSuite(text.slice(0, m.index));
    if (subject) return scope(subject.all, subject.count);
  }
  if (ALL_N_PASS.test(text)) return {};
  const passed = N_PASSED.exec(text);
  if (passed && wholeSuite(text.slice(0, passed.index))) return scope(false, Number(passed[1]));
  return undefined;
}

/**
 * The agent's claim that the whole test suite passes, or undefined if it doesn't make one.
 * Deliberately conservative: a missed claim costs one unchecked stop, a wrong one would block an honest agent.
 */
export function findPassClaim(message: string | undefined): Claim | undefined {
  if (!message) return undefined;
  for (const raw of prose(message).split(/(?<=[.!?])\s+|\n+/)) {
    const sentence = raw.replace(/^[\s*_#>-]*(\d+\.\s+)?/, "").replace(/[\s*_]+$/, "");
    if (!sentence || sentence.endsWith("?")) continue;
    const found = claimIn(normalize(sentence));
    if (found) return { text: sentence.length > 120 ? `${sentence.slice(0, 117)}...` : sentence, ...found };
  }
  return undefined;
}
