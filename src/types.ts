export type FileKind = "test" | "source" | "test-config" | "ci" | "policy" | "other";

export type ChangeStatus = "added" | "modified" | "deleted" | "renamed";

export interface FileChange {
  path: string;
  oldPath?: string;
  status: ChangeStatus;
  kind: FileKind;
  before?: string;
  after?: string;
}

export type Severity = "block" | "warn";

export interface Finding {
  ruleId: string;
  severity: Severity;
  file: string;
  line?: number;
  message: string;
  /** Short instruction for the agent (~50 tokens). */
  agentHint: string;
  needsJudgement?: boolean;
}

export interface RuleContext {
  change: FileChange;
}

export interface Rule {
  id: string;
  name: string;
  severity: Severity;
  check(ctx: RuleContext): Finding[];
}

export type Verdict = "PASS" | "SUSPICIOUS" | "FAIL";
