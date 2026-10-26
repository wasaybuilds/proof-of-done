import type { Rule } from "../types.js";

const MAX_NAMED = 3;

/** The agent said the tests pass, but re-running them shows failures. */
export const claimMismatch: Rule = {
  id: "POD013",
  name: "claim-mismatch",
  severity: "block",
  check(ctx) {
    const { claim, testRun } = ctx;
    if (!claim || !testRun?.failed.length) return [];
    const n = testRun.failed.length;
    const named = testRun.failed.slice(0, MAX_NAMED).map((t) => `"${t.name}"`).join(", ") + (n > MAX_NAMED ? `, +${n - MAX_NAMED} more` : "");
    return [
      {
        ruleId: this.id,
        severity: this.severity,
        file: testRun.failed[0]?.file ?? "tests",
        message: `claimed "${claim}", but ${n} of ${testRun.total} tests fail when re-run (\`${testRun.command}\`): ${named}`,
        agentHint: `You said "${claim}", but re-running the tests shows ${n} failing: ${named}. Fix them, or say plainly which tests fail.`,
      },
    ];
  },
};
