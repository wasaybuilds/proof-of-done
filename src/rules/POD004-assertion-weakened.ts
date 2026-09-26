import type { Finding, Rule } from "../types.js";

/** Specific checks replaced by weaker ones in the same test: toEqual(x) → toBeDefined(), assertEqual → assertTrue, == → > 0. */
export const assertionWeakened: Rule = {
  id: "POD004",
  name: "assertion-weakened",
  severity: "warn",
  check(ctx) {
    const findings: Finding[] = [];

    for (const file of ctx.files) {
      if (!file.beforeTests || !file.afterTests) continue;
      const before = new Map(file.beforeTests.map((t) => [t.name, t]));
      const path = file.change.path;

      for (const t of file.afterTests) {
        const prev = before.get(t.name);
        if (!prev || t.skipped) continue;
        const weakened = Math.min(prev.strength.exact - t.strength.exact, t.strength.weak - prev.strength.weak);
        if (weakened <= 0) continue;
        findings.push({
          ruleId: this.id,
          severity: this.severity,
          file: path,
          line: t.line,
          message: `${weakened} specific assertion${weakened === 1 ? "" : "s"} replaced by weaker ones in "${t.name}" (exact ${prev.strength.exact} → ${t.strength.exact}, weak ${prev.strength.weak} → ${t.strength.weak})`,
          agentHint: `You replaced ${weakened} specific assertion(s) in "${t.name}" (${path}) with weaker checks like toBeDefined/assertTrue/> 0. Restore the exact expected values and fix the code instead.`,
        });
      }
    }
    return findings;
  },
};
