import type { Finding, Rule } from "../types.js";
import { balancedSeverity, bareName, REFACTOR_NOTE, testBalance } from "./balance.js";

export const testDeleted: Rule = {
  id: "POD001",
  name: "test-deleted",
  severity: "block",
  check(ctx) {
    const balance = testBalance(ctx);
    const severity = balancedSeverity(balance);
    const note = severity === "warn" ? ` — ${REFACTOR_NOTE}` : "";
    const findings: Finding[] = [];

    for (const file of ctx.files) {
      if (!file.beforeTests?.length) continue;
      const after = new Set(file.afterTests?.map((t) => t.name) ?? []);
      const missing = file.beforeTests.filter(
        (t) => !after.has(t.name) && !(t.body && balance.movedBodies.has(t.body)) && !balance.movedNames.has(bareName(t)),
      );
      if (!missing.length) continue;

      const path = file.change.oldPath ?? file.change.path;
      if (file.change.status === "deleted") {
        findings.push({
          ruleId: this.id,
          severity,
          file: path,
          message: `test file deleted (${missing.length} test${missing.length === 1 ? "" : "s"})${note}`,
          agentHint:
            severity === "warn"
              ? `You deleted test file ${path}. If its tests moved, make sure every case is still covered; otherwise restore it.`
              : `You deleted test file ${path} (${missing.length} tests). Restore it and fix the code under test instead.`,
        });
        continue;
      }
      for (const t of missing) {
        findings.push({
          ruleId: this.id,
          severity,
          file: path,
          message: `removed test "${t.name}" (was line ${t.line})${note}`,
          agentHint:
            severity === "warn"
              ? `You removed test "${t.name}" in ${path}. If a new test replaces it, make sure it covers the same cases; otherwise restore it.`
              : `You deleted test "${t.name}" in ${path}. Restore it and fix the code under test instead.`,
        });
      }
    }
    return findings;
  },
};
