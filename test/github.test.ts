import { describe, expect, it } from "vitest";
import { githubAnnotations, markdownSummary } from "../src/feedback/github.js";
import type { Finding } from "../src/types.js";

const removed: Finding = {
  ruleId: "POD001",
  severity: "block",
  file: "src/a.test.ts",
  line: 4,
  message: 'removed test "a, b: c" (was line 4)',
  agentHint: "",
};
const weakened: Finding = { ruleId: "POD004", severity: "warn", file: "tests/x.py", message: "weaker\nassertion", agentHint: "" };

describe("githubAnnotations", () => {
  it("emits error/warning workflow commands with file, line and escaped text", () => {
    expect(githubAnnotations([removed, weakened]).split("\n")).toEqual([
      `::error file=src/a.test.ts,line=4,title=Proof of Done POD001::removed test "a, b: c" (was line 4)`,
      `::warning file=tests/x.py,title=Proof of Done POD004::weaker%0Aassertion`,
    ]);
  });

  it("escapes commas and colons in properties", () => {
    expect(githubAnnotations([{ ...removed, file: "odd,name:x.test.ts" }])).toContain("file=odd%2Cname%3Ax.test.ts");
  });
});

describe("markdownSummary", () => {
  it("reports a clean pass", () => {
    expect(markdownSummary({ verdict: "PASS", findings: [], filesChecked: 3 })).toBe(
      "## ✅ Proof of Done: PASS\n\nNo test tampering found in 3 changed files.\n",
    );
  });

  it("lists findings in a table and explains how to approve", () => {
    const md = markdownSummary({ verdict: "FAIL", findings: [removed], filesChecked: 1 });
    expect(md).toContain("## ❌ Proof of Done: FAIL");
    expect(md).toContain("| POD001 | blocking | `src/a.test.ts:4` | removed test");
    expect(md).toContain("`proof-of-done: allow` label");
  });

  it("notes the approval instead when the label is present", () => {
    const md = markdownSummary({ verdict: "FAIL", findings: [removed], filesChecked: 1 }, "proof-of-done: allow");
    expect(md).toContain("approved with the `proof-of-done: allow` label");
    expect(md).not.toContain("a maintainer can add");
  });
});
