export type FileKind = "test" | "source" | "test-config" | "ci" | "policy" | "agent-config" | "other";

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
  /** The test the finding is about, when it's about one test (not a whole file). */
  test?: string;
  message: string;
  /** Short instruction for the agent (~50 tokens). */
  agentHint: string;
  needsJudgement?: boolean;
}

/** A test case that failed or errored in a JUnit report. */
export interface FailedTest {
  name: string;
  /** Source file, or the class/module name when the report has no file. */
  file?: string;
}

/** Results of re-running the project's tests, read from the JUnit XML report (never console output). */
export interface TestRun {
  command: string;
  total: number;
  skipped: number;
  failed: FailedTest[];
}

export interface RuleContext {
  files: AnalyzedFile[];
  /** The agent's claim that tests pass, quoted from its final message. */
  claim?: string;
  /** Present when the tests were re-run to check the claim. */
  testRun?: TestRun;
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
