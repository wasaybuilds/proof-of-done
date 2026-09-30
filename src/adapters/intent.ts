import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { Finding } from "../types.js";

/** Findings a user can legitimately ask for: removing, skipping or trimming tests, or changing CI/guardrail setup. */
const APPROVABLE = new Set(["POD001", "POD002", "POD003", "POD008"]);

const VERB = /\b(delete|deleting|remove|removing|drop|dropping|skip|skipping|disable|disabling|get rid of|rip out|comment out|commenting out)\b/g;
// Guardrail/CI changes are usually edits, not removals.
const CONFIG_VERB = /\b(edit|editing|change|changing|update|updating|modify|modifying|fix|fixing|configure|set up|setup|rewrite|rename|exclude|delete|deleting|remove|removing|disable|disabling|drop|turn off|uninstall)\b/g;
const CONFIG_WORDS: Record<string, string[]> = {
  ci: ["ci", "workflow", "workflows", "pipeline", "github actions", "github action"],
  policy: ["proofofdone", "proof of done config"],
  "agent-config": ["proof of done", "proof-of-done", "hook", "hooks", "guardrail"],
};
const NEGATION = /\b(don'?t|do not|never|without|not|no need to|stop)\s+(\w+\s+){0,2}$/;
// A clause ends at a conjunction or punctuation: in "remove the log and fix the failing test", "failing test" isn't the object.
const CLAUSE_END = /\s(and|then|but|so|because|while)\s|[,;:]/;
const GENERIC_TARGET = /\b(failing|broken|flaky|that|this|those|these|its|their|the|old|obsolete)\s+(\w+\s+)?tests?\b/;
const STOPWORDS = new Set(["should", "returns", "return", "handles", "works", "when", "given", "correctly", "properly", "with", "without"]);

/**
 * The user's own messages in a Claude Code session transcript (JSONL).
 * Tool results and hook feedback are excluded, so the agent can't put words in the user's mouth.
 */
export function readUserPrompts(transcriptPath: string | undefined): string[] {
  if (!transcriptPath) return [];
  let text: string;
  try {
    text = readFileSync(transcriptPath, "utf8");
  } catch {
    return [];
  }
  const prompts: string[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let entry: { type?: string; isMeta?: boolean; message?: { role?: string; content?: unknown } };
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.type !== "user" || entry.isMeta || entry.message?.role !== "user") continue;
    const content = entry.message.content;
    let prompt = "";
    if (typeof content === "string") prompt = content;
    else if (Array.isArray(content) && !content.some((c) => c?.type === "tool_result")) {
      prompt = content.filter((c) => c?.type === "text").map((c) => String(c.text ?? "")).join("\n");
    }
    if (prompt && !/^\s*(Stop hook feedback|<)/.test(prompt)) prompts.push(prompt);
  }
  return prompts;
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Words that identify the target of a finding: file name, file stem, distinctive words of the test name. */
function targetsOf(finding: Finding): string[] {
  const file = basename(finding.file).toLowerCase();
  const stem = file.replace(/\.(test|spec)\b.*$/, "").replace(/^test_/, "").replace(/\.[^.]+$/, "");
  const words = (finding.test ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 5 && !STOPWORDS.has(w));
  return [file, stem, ...words].filter((t) => t.length >= 3);
}

/**
 * Did the user explicitly ask for this change? True when one of their messages has an
 * un-negated removal verb ("delete", "remove", "skip", …) whose object refers to the finding's
 * file or test ("delete its test in src/discount.test.ts", "remove the percentage test").
 */
export function userAsked(finding: Finding, prompts: string[], kind?: string): boolean {
  if (!APPROVABLE.has(finding.ruleId) || !prompts.length) return false;
  const config = finding.ruleId === "POD008";
  // For CI/guardrail files only the file name and config words count: "delete that failing test" must never approve a CI edit.
  const targets = config ? [basename(finding.file).toLowerCase(), ...(CONFIG_WORDS[kind ?? ""] ?? [])] : targetsOf(finding);
  const verbs = config ? CONFIG_VERB : VERB;
  for (const prompt of prompts) {
    const text = prompt.toLowerCase().replace(/\s+/g, " ");
    for (const m of text.matchAll(verbs)) {
      const before = text.slice(0, m.index);
      if (NEGATION.test(before)) continue;
      const rest = text.slice((m.index ?? 0) + m[0].length);
      const end = rest.search(CLAUSE_END);
      const clause = (end === -1 ? rest : rest.slice(0, end)).split(" ").slice(0, 10).join(" ");
      if ((!config && GENERIC_TARGET.test(clause)) || targets.some((t) => new RegExp(`\\b${escape(t)}\\b`).test(clause))) return true;
    }
  }
  return false;
}
