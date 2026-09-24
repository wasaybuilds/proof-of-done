import type { FileKind } from "../types.js";

const POLICY = /(^|\/)\.proofofdone\.ya?ml$/;

const CI = [
  /^\.github\/workflows\//,
  /(^|\/)\.gitlab-ci\.ya?ml$/,
  /^\.circleci\//,
  /(^|\/)azure-pipelines\.ya?ml$/,
  /(^|\/)Jenkinsfile$/,
];

const TEST_CONFIG = [
  /(^|\/)(jest|vitest|mocha|karma|playwright|cypress)\.config\.[cm]?[jt]s$/,
  /(^|\/)\.mocharc(\.[a-z]+)?$/,
  /(^|\/)pytest\.ini$/,
  /(^|\/)tox\.ini$/,
  /(^|\/)conftest\.py$/,
  /(^|\/)\.coveragerc$/,
  /(^|\/)(\.)?nycrc(\.[a-z]+)?$/,
];

const TEST = [
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /(^|\/)__tests__\//,
  /(^|\/)test_[^/]+\.py$/,
  /(^|\/)[^/]+_test\.(py|go)$/,
  /(^|\/)tests?\/.+\.(py|[cm]?[jt]sx?)$/,
];

const SOURCE = /\.(py|[cm]?[jt]sx?|go|rs|java|kt|rb|php|cs)$/;

/** Classify a repo-relative path. Order matters: policy > ci > test-config > test > source. */
export function classifyPath(path: string): FileKind {
  const p = path.replace(/\\/g, "/");
  if (POLICY.test(p)) return "policy";
  if (CI.some((r) => r.test(p))) return "ci";
  if (TEST_CONFIG.some((r) => r.test(p))) return "test-config";
  if (TEST.some((r) => r.test(p))) return "test";
  if (SOURCE.test(p)) return "source";
  return "other";
}
