import { extractTests, languageForPath } from "./parse/index.js";
import { rules as defaultRules } from "./rules/index.js";
import type { AnalyzedFile, FileChange, Finding, Rule, Verdict, VerifyResult } from "./types.js";

export async function analyze(changes: FileChange[]): Promise<AnalyzedFile[]> {
  return Promise.all(
    changes.map(async (change): Promise<AnalyzedFile> => {
      const lang = change.kind === "test" ? languageForPath(change.path) : undefined;
      if (!lang) return { change };
      const [beforeTests, afterTests] = await Promise.all([
        change.before === undefined ? undefined : extractTests(change.before, lang),
        change.after === undefined ? undefined : extractTests(change.after, lang),
      ]);
      return {
        change,
        lang,
        ...(beforeTests && { beforeTests }),
        ...(afterTests && { afterTests }),
      };
    }),
  );
}

export function verdictOf(findings: Finding[]): Verdict {
  if (findings.some((f) => f.severity === "block")) return "FAIL";
  return findings.length ? "SUSPICIOUS" : "PASS";
}

export async function verify(changes: FileChange[], rules: readonly Rule[] = defaultRules): Promise<VerifyResult> {
  const files = await analyze(changes);
  const findings = rules.flatMap((rule) => rule.check({ files }));
  return { verdict: verdictOf(findings), findings, filesChecked: files.length };
}
