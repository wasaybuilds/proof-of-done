// Sentences that state the tests pass: "All tests pass.", "All 28 tests are passing", "The test suite is green",
// "42 tests passed", "12 passed, 0 failed".
const PASS = [
  /\ball (?:the )?(?:\d+ )?(?:of the )?(?:[\w-]+ )?tests? (?:are |now |still )*(?:pass(?:es|ed|ing)?|green|succeed(?:s|ed)?)\b/,
  /\ball \d+ (?:are |now )*pass(?:ed|ing)?\b/,
  /\b(?:test suite|tests|test run|suite) (?:is |are |now |all |still )*(?:pass(?:es|ed|ing)?|green)\b/,
  /\b\d+(?: ?\/ ?\d+)? (?:[\w-]+ )?tests? (?:are |all )*pass(?:ed|ing)?\b/,
  /\b\d+ passed\b/,
];

// Anything that makes a sentence something other than a plain statement that the tests pass now:
// negations, failures, conditions, plans and hopes, partial claims.
const NOT_A_CLAIM =
  /\b(not|no longer|never|cannot|can't|couldn't|won't|wouldn't|don't|doesn't|didn't|isn't|aren't|wasn't|weren't|haven't|hasn't|fail(s|ed|ing|ures?)?|errors?|broken|until|unless|if|once|when|whether|before|should|will|would|could|might|may|must|needs?|try|trying|expect|hopefully|make|making|get|getting|ensure|except|excluding|apart from|other than|besides)\b/;

// "0 failed", "no failures": a failure word that reports zero failures.
const ZERO_FAILURES = /\b(0|no|zero) (failed|failures?|failing|errors?)\b|\bwithout (any )?(failures?|errors?)\b/g;

/** Code, quotes and pasted output aren't the agent's own statement. */
function prose(message: string): string {
  return message
    .replace(/```[\s\S]*?(```|$)/g, "\n")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/^\s*>.*$/gm, "");
}

/**
 * The sentence in which the agent states that the tests pass, or undefined if it doesn't.
 * Deliberately conservative: a missed claim costs one unchecked stop, a wrong one would block an honest agent.
 */
export function findPassClaim(message: string | undefined): string | undefined {
  if (!message) return undefined;
  for (const raw of prose(message).split(/(?<=[.!?])\s+|\n+/)) {
    const sentence = raw.replace(/^[\s*_#>-]*(\d+\.\s+)?/, "").replace(/[\s*_]+$/, "");
    if (!sentence || sentence.endsWith("?")) continue;
    const text = sentence.toLowerCase().replace(/[*_]/g, "").replace(/\s+/g, " ");
    if (!PASS.some((p) => p.test(text))) continue;
    if (NOT_A_CLAIM.test(text.replace(ZERO_FAILURES, ""))) continue;
    return sentence.length > 120 ? `${sentence.slice(0, 117)}...` : sentence;
  }
  return undefined;
}
