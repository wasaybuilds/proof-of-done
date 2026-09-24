import type { RuleContext, Severity, TestCase } from "../types.js";

/** Test name without its suite path: "TestCart > test_add" → "test_add". */
export const bareName = (t: TestCase): string => t.name.split(" > ").pop() ?? t.name;

export interface TestBalance {
  /** Bodies and bare names of tests that are new somewhere in this change — a missing test that reappears here was moved or renamed. */
  movedBodies: Set<string>;
  movedNames: Set<string>;
  /** Assertions in tests that disappeared, plus assertions dropped from surviving tests. */
  removedAssertions: number;
  /** Assertions in new tests, plus assertions gained by surviving tests. */
  addedAssertions: number;
}

/**
 * Change-wide view of test strength. Refactors (splitting files, splitting tests, parametrising)
 * remove tests in one place and add them in another; cheating removes them without replacement.
 */
export function testBalance(ctx: RuleContext): TestBalance {
  const movedBodies = new Set<string>();
  const movedNames = new Set<string>();
  let removedAssertions = 0;
  let addedAssertions = 0;

  for (const file of ctx.files) {
    const before = new Map((file.beforeTests ?? []).map((t) => [t.name, t]));
    const after = new Map((file.afterTests ?? []).map((t) => [t.name, t]));
    for (const t of after.values()) {
      const prev = before.get(t.name);
      if (!prev) {
        addedAssertions += t.assertions;
        if (t.body) movedBodies.add(t.body);
        movedNames.add(bareName(t));
      } else if (t.assertions > prev.assertions) {
        addedAssertions += t.assertions - prev.assertions;
      }
    }
    for (const t of before.values()) {
      const next = after.get(t.name);
      if (!next) removedAssertions += t.assertions;
      else if (!next.skipped && next.assertions < t.assertions) removedAssertions += t.assertions - next.assertions;
    }
  }
  return { movedBodies, movedNames, removedAssertions, addedAssertions };
}

/** Block when overall test strength drops; only warn when the change adds at least as much as it removes. */
export function balancedSeverity(balance: TestBalance): Severity {
  return balance.addedAssertions > 0 && balance.addedAssertions >= balance.removedAssertions ? "warn" : "block";
}

export const REFACTOR_NOTE = "the same change adds at least as many assertions elsewhere, so this may be a refactor";
