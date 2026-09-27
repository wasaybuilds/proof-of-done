import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { Finding } from "../types.js";

/** Findings a user can legitimately ask for: removing, skipping or trimming tests. */
const APPROVABLE = new Set(["POD001", "POD002", "POD003"]);

const VERB = /\b(delete|deleting|remove|removing|drop|dropping|skip|skipping|disable|disabling|get rid of|rip out|comment out|commenting out)\b/g;
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
export function userAsked(finding: Finding, prompts: string[]): boolean {
  if (!APPROVABLE.has(finding.ruleId) || !prompts.length) return false;
  const targets = targetsOf(finding);
  for (const prompt of prompts) {
    const text = prompt.toLowerCase().replace(/\s+/g, " ");
    for (const m of text.matchAll(VERB)) {
      const before = text.slice(0, m.index);
      if (NEGATION.test(before)) continue;
      const rest = text.slice((m.index ?? 0) + m[0].length);
      const end = rest.search(CLAUSE_END);
      const clause = (end === -1 ? rest : rest.slice(0, end)).split(" ").slice(0, 10).join(" ");
      if (GENERIC_TARGET.test(clause) || targets.some((t) => clause.includes(t))) return true;
    }
  }
  return false;
}
