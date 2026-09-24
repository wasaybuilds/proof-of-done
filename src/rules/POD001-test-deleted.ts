import type { Finding, Rule } from "../types.js";

/** Bodies of tests that are new in this change — a "deleted" test whose body reappears was renamed or moved. */
function newTestBodies(ctx: Parameters<Rule["check"]>[0]): Set<string> {
  const bodies = new Set<string>();
  for (const file of ctx.files) {
    const before = new Set(file.beforeTests?.map((t) => t.name) ?? []);
    for (const t of file.afterTests ?? []) {
      if (!before.has(t.name) && t.body) bodies.add(t.body);
    }
  }
  return bodies;
}

export const testDeleted: Rule = {
  id: "POD001",
  name: "test-deleted",
  severity: "block",
  check(ctx) {
    const moved = newTestBodies(ctx);
    const findings: Finding[] = [];

    for (const file of ctx.files) {
      if (!file.beforeTests?.length) continue;
      const after = new Set(file.afterTests?.map((t) => t.name) ?? []);
      const missing = file.beforeTests.filter((t) => !after.has(t.name) && !(t.body && moved.has(t.body)));
      if (!missing.length) continue;

      const path = file.change.oldPath ?? file.change.path;
      if (file.change.status === "deleted") {
        findings.push({
          ruleId: this.id,
          severity: this.severity,
          file: path,
          message: `test file deleted (${missing.length} test${missing.length === 1 ? "" : "s"})`,
          agentHint: `You deleted test file ${path} (${missing.length} tests). Restore it and fix the code under test instead.`,
        });
        continue;
      }
      for (const t of missing) {
        findings.push({
          ruleId: this.id,
          severity: this.severity,
          file: path,
          message: `removed test "${t.name}" (was line ${t.line})`,
          agentHint: `You deleted test "${t.name}" in ${path}. Restore it and fix the code under test instead.`,
        });
      }
    }
    return findings;
  },
};
