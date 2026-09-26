import type { Finding, Rule } from "../types.js";

/** Assertions that can't fail were added: expect(true).toBe(true), assert True, x == x, or asserts swallowed by try/except. */
export const vacuousAssertion: Rule = {
  id: "POD005",
  name: "vacuous-assertion",
  severity: "block",
  check(ctx) {
    const findings: Finding[] = [];

    for (const file of ctx.files) {
      if (!file.afterTests) continue;
      const before = new Map((file.beforeTests ?? []).map((t) => [t.name, t]));
      const path = file.change.path;

      for (const t of file.afterTests) {
        if (t.skipped) continue;
        const existing = before.get(t.name)?.strength.vacuous ?? 0;
        const added = t.strength.vacuous - existing;
        if (added <= 0) continue;
        findings.push({
          ruleId: this.id,
          severity: this.severity,
          file: path,
          line: t.vacuousLines[existing] ?? t.line,
          message: `${added} assertion${added === 1 ? "" : "s"} that can't fail added to "${t.name}"`,
          agentHint: `You added ${added} assertion(s) in "${t.name}" (${path}) that can never fail (constant values, comparing a value to itself, or swallowed by try/catch). Assert the real expected behaviour instead.`,
        });
      }
    }
    return findings;
  },
};
