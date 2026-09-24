import type { Finding, Rule } from "../types.js";
import { balancedSeverity, REFACTOR_NOTE, testBalance } from "./balance.js";

export const assertionRemoved: Rule = {
  id: "POD003",
  name: "assertion-removed",
  severity: "block",
  check(ctx) {
    const severity = balancedSeverity(testBalance(ctx));
    const note = severity === "warn" ? ` — ${REFACTOR_NOTE}` : "";
    const findings: Finding[] = [];

    for (const file of ctx.files) {
      if (!file.beforeTests || !file.afterTests) continue;
      const before = new Map(file.beforeTests.map((t) => [t.name, t]));
      const path = file.change.path;

      for (const t of file.afterTests) {
        const prev = before.get(t.name);
        // Skipped tests are reported by POD002; don't double-report.
        if (!prev || t.skipped || t.assertions >= prev.assertions) continue;
        const removed = prev.assertions - t.assertions;
        findings.push({
          ruleId: this.id,
          severity,
          file: path,
          line: t.line,
          message: `${removed} assertion${removed === 1 ? "" : "s"} removed from "${t.name}" (${prev.assertions} → ${t.assertions})${note}`,
          agentHint:
            severity === "warn"
              ? `You removed ${removed} assertion(s) from "${t.name}" in ${path}. If they moved to new tests, fine; otherwise restore them.`
              : `You removed ${removed} assertion(s) from "${t.name}" in ${path}. Restore them and fix the code instead.`,
        });
      }
    }
    return findings;
  },
};
