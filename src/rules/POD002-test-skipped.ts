import type { Finding, Rule } from "../types.js";

export const testSkipped: Rule = {
  id: "POD002",
  name: "test-skipped",
  severity: "block",
  check(ctx) {
    const findings: Finding[] = [];

    for (const file of ctx.files) {
      if (!file.beforeTests || !file.afterTests) continue;
      const before = new Map(file.beforeTests.map((t) => [t.name, t]));
      const path = file.change.path;

      for (const t of file.afterTests) {
        const prev = before.get(t.name);
        if (prev && !prev.skipped && t.skipped) {
          findings.push({
            ruleId: this.id,
            severity: this.severity,
            file: path,
            line: t.line,
            message: `test "${t.name}" is now skipped`,
            agentHint: `You disabled test "${t.name}" in ${path}. Remove the skip and make it pass by fixing the code.`,
          });
        }
      }

      const newlyFocused = file.afterTests.filter((t) => t.focused && !before.get(t.name)?.focused);
      const hasOthers = file.afterTests.some((t) => !t.focused && !t.skipped);
      const first = newlyFocused[0];
      if (first && hasOthers) {
        findings.push({
          ruleId: this.id,
          severity: this.severity,
          file: path,
          line: first.line,
          message: `.only added to "${first.name}" — other tests in this file no longer run`,
          agentHint: `You added .only in ${path}, which silently skips the other tests. Remove it.`,
        });
      }
    }
    return findings;
  },
};
