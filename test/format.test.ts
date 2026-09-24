import { describe, expect, it } from "vitest";
import { agentFeedback, humanReport } from "../src/feedback/format.js";
import type { Finding } from "../src/types.js";

const finding = (i: number): Finding => ({
  ruleId: "POD001",
  severity: "block",
  file: "t.test.ts",
  line: i,
  message: `removed test "t${i}"`,
  agentHint: `Restore t${i}.`,
});

describe("agentFeedback", () => {
  it("caps the number of hints and summarises the rest", () => {
    const text = agentFeedback([1, 2, 3, 4, 5, 6, 7].map(finding));
    expect(text).toContain("Restore t5.");
    expect(text).not.toContain("Restore t6.");
    expect(text).toContain("+2 more");
  });
});

describe("humanReport", () => {
  it("reports PASS without findings", () => {
    expect(humanReport({ verdict: "PASS", findings: [], filesChecked: 3 })).toBe("✓ PASS  no tampering detected");
  });

  it("lists findings with location and agent feedback", () => {
    const report = humanReport({ verdict: "FAIL", findings: [finding(4)], filesChecked: 1 });
    expect(report).toContain("✗ FAIL  1 blocking, 0 warning");
    expect(report).toContain("POD001  block  t.test.ts:4  removed test \"t4\"");
    expect(report).toContain("→ to agent: Restore t4.");
  });
});
