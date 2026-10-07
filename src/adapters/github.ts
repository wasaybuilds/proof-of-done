import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

export const WORKFLOW_PATH = join(".github", "workflows", "proof-of-done.yml");

export const WORKFLOW = `name: Proof of Done

on:
  pull_request:
    types: [opened, synchronize, reopened, labeled, unlabeled]

permissions:
  contents: read

jobs:
  # A distinctive job name: required checks match by name, and "verify" is common in other workflows.
  proof-of-done:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: wasaybuilds/proof-of-done@v0
`;

/**
 * The checker itself: the workflow that runs it, the agent hooks, and its config. A pull request can edit
 * its own workflow, so changes here should need a review from someone other than the agent.
 */
export const CHECKER_PATHS = ["/.github/", "/.claude/", "/.proofofdone.yml"];

/** The required status check this workflow reports. */
export const CHECK_NAME = "proof-of-done";

// GitHub uses the first of these that exists (and reads it from the pull request's base branch).
const CODEOWNERS_LOCATIONS = [join(".github", "CODEOWNERS"), "CODEOWNERS", join("docs", "CODEOWNERS")];
const CODEOWNERS_MARKER = "# Proof of Done: changes to the checker (workflows, agent hooks, config) need a code owner's review.";
const OWNER = /^(@[A-Za-z0-9][\w.-]*(\/[\w.-]+)?|[^@\s]+@[^@\s]+\.[^@\s]+)$/;

export function isValidOwner(owner: string): boolean {
  return OWNER.test(owner);
}

export interface GithubInstallResult {
  workflow: { path: string; created: boolean };
  codeowners?: { path: string; added: string[] };
}

/**
 * Writes the Proof of Done workflow (unless one exists) and, when owners are given, adds the checker's paths
 * to CODEOWNERS so changes to them need a code owner's review. Existing entries are left alone.
 */
export function installGithub(repo: string, owners: string[] = []): GithubInstallResult {
  const invalid = owners.filter((o) => !isValidOwner(o));
  if (invalid.length) throw new Error(`not a GitHub user, team or email: ${invalid.join(", ")}`);

  const workflowFile = join(repo, WORKFLOW_PATH);
  const created = !existsSync(workflowFile);
  if (created) {
    mkdirSync(dirname(workflowFile), { recursive: true });
    writeFileSync(workflowFile, WORKFLOW);
  }
  const result: GithubInstallResult = { workflow: { path: workflowFile, created } };
  if (!owners.length) return result;

  const existing = CODEOWNERS_LOCATIONS.map((p) => join(repo, p)).find((p) => existsSync(p));
  const file = existing ?? join(repo, CODEOWNERS_LOCATIONS[0] ?? "CODEOWNERS");
  const current = existing ? readFileSync(file, "utf8") : "";
  // A CODEOWNERS file outside .github/ must own itself, or a pull request could weaken it for the next one.
  const self = "/" + relative(repo, file).split("\\").join("/");
  const wanted = self.startsWith("/.github/") ? CHECKER_PATHS : [...CHECKER_PATHS, self];

  // In CODEOWNERS the last matching line wins, so a path listed earlier may not be effective any more.
  // Our block goes at the end (where it takes effect) and keeps any owners already listed for the same path.
  const lines = current.split(/\r?\n/);
  const ownersOf = (path: string, from: string[]): string[] | undefined => {
    const line = [...from].reverse().find((l) => l.trim().split(/\s+/)[0] === path);
    return line?.trim().split(/\s+/).slice(1);
  };
  const markerAt = lines.lastIndexOf(CODEOWNERS_MARKER);
  const ourBlock = markerAt >= 0 ? lines.slice(markerAt + 1) : [];
  const upToDate = wanted.every((p) => owners.every((o) => ownersOf(p, ourBlock)?.includes(o)));
  if (upToDate) return { ...result, codeowners: { path: file, added: [] } };

  const block = [
    CODEOWNERS_MARKER,
    ...wanted.map((p) => `${p} ${[...new Set([...(ownersOf(p, lines) ?? []), ...owners])].join(" ")}`),
  ].join("\n");
  const sep = current && !current.endsWith("\n") ? "\n\n" : current ? "\n" : "";
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${current}${sep}${block}\n`);
  return { ...result, codeowners: { path: file, added: wanted } };
}
