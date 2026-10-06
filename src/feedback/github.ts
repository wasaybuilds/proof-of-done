import type { Finding, VerifyResult } from "../types.js";

// Workflow-command escaping: https://docs.github.com/actions/reference/workflow-commands-for-github-actions
const escapeData = (s: string): string => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escapeProperty = (s: string): string => escapeData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");

/** One `::error` / `::warning` line per finding, so GitHub shows it on the line in the pull request. */
export function githubAnnotations(findings: Finding[]): string {
  return findings
    .map((f) => {
      const level = f.severity === "block" ? "error" : "warning";
      const props = [`file=${escapeProperty(f.file)}`, ...(f.line ? [`line=${f.line}`] : []), `title=${escapeProperty(`Proof of Done ${f.ruleId}`)}`];
      return `::${level} ${props.join(",")}::${escapeData(f.message)}`;
    })
    .join("\n");
}

const cell = (s: string): string => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** Markdown for the job summary page. */
export function markdownSummary(result: VerifyResult, approvedBy?: string): string {
  const icon = { PASS: "✅", SUSPICIOUS: "⚠️", FAIL: "❌" }[result.verdict];
  const lines = [`## ${icon} Proof of Done: ${result.verdict}`, ""];
  if (!result.findings.length) {
    lines.push(`No test tampering found in ${result.filesChecked} changed file${result.filesChecked === 1 ? "" : "s"}.`);
    return lines.join("\n") + "\n";
  }
  if (approvedBy) lines.push(`> Not failing the check: approved with the \`${approvedBy}\` label.`, "");
  lines.push("| Rule | Severity | Where | Finding |", "|---|---|---|---|");
  for (const f of result.findings) {
    const where = f.line ? `${f.file}:${f.line}` : f.file;
    lines.push(`| ${f.ruleId} | ${f.severity === "block" ? "blocking" : "warning"} | \`${cell(where)}\` | ${cell(f.message)} |`);
  }
  if (result.verdict === "FAIL" && !approvedBy) {
    lines.push("", "If these changes are intended, a maintainer can add the `proof-of-done: allow` label to the pull request.");
  }
  return lines.join("\n") + "\n";
}
