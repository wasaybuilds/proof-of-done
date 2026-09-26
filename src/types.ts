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

export type Lang = "typescript" | "tsx" | "javascript" | "python";

/** A single test case extracted from a test file. */
export interface TestCase {
  /** Suite path + test name, e.g. "auth > rejects expired token". */
  name: string;
  /** 1-based line of the test declaration. */
  line: number;
  skipped: boolean;
  /** `.only` / `fit` — silently skips sibling tests. */
  focused: boolean;
  assertions: number;
  /** Assertions by strength. exact + weak + vacuous === assertions. */
  strength: AssertionStrength;
  /** 1-based lines of assertions that cannot fail. */
  vacuousLines: number[];
  /** Whitespace-normalised body, used to match renamed or moved tests. */
  body: string;
}

/**
 * exact:   checks a specific value, error or call (`toBe(3)`, `assert x == 3`, `assertEqual`)
 * weak:    only checks existence, truthiness or a bound (`toBeDefined()`, `assert x`, `> 0`, `toThrow()`)
 * vacuous: cannot fail (`expect(true).toBe(true)`, `assert True`, `x == x`, swallowed by try/except)
 */
export interface AssertionStrength {
  exact: number;
  weak: number;
  vacuous: number;
}

export interface AnalyzedFile {
  change: FileChange;
  lang?: Lang;
  beforeTests?: TestCase[];
  afterTests?: TestCase[];
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
  files: AnalyzedFile[];
}

export interface Rule {
  id: string;
  name: string;
  severity: Severity;
  check(ctx: RuleContext): Finding[];
}

export type Verdict = "PASS" | "SUSPICIOUS" | "FAIL";

export interface VerifyResult {
  verdict: Verdict;
  findings: Finding[];
  filesChecked: number;
}
