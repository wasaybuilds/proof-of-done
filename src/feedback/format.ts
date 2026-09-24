import type { Finding, VerifyResult } from "../types.js";

const ICON = { PASS: "✓", SUSPICIOUS: "!", FAIL: "✗" } as const;

export function humanReport(result: VerifyResult): string {
  const { verdict, findings } = result;
  const blocking = findings.filter((f) => f.severity === "block").length;
  const lines = [
    `${ICON[verdict]} ${verdict}  ${findings.length ? `${blocking} blocking, ${findings.length - blocking} warning` : "no tampering detected"}`,
  ];
  if (findings.length) lines.push("");
  for (const f of findings) {
    const where = f.line ? `${f.file}:${f.line}` : f.file;
    lines.push(`${f.ruleId}  ${f.severity === "block" ? "block" : "warn "}  ${where}  ${f.message}`);
  }
  if (findings.length) lines.push("", `→ to agent: ${agentFeedback(findings)}`);
  return lines.join("\n");
}

/** Compact instruction for the agent. Capped so the feedback itself can't blow up the context. */
export function agentFeedback(findings: Finding[], max = 5): string {
  const shown = findings.slice(0, max).map((f) => f.agentHint);
  const rest = findings.length - shown.length;
  if (rest > 0) shown.push(`(+${rest} more — run \`proof-of-done verify\` for the full list.)`);
  return shown.join(" ");
}
