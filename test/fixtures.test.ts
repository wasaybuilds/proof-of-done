import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { classifyPath } from "../src/changeset/classify.js";
import { verify } from "../src/engine.js";
import type { FileChange } from "../src/types.js";

const ROOT = fileURLToPath(new URL("../fixtures", import.meta.url));

function filesUnder(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(dir)) return out;
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.set(relative(dir, p).replace(/\\/g, "/"), readFileSync(p, "utf8"));
    }
  };
  walk(dir);
  return out;
}

/** Build a ChangeSet by diffing a fixture's before/ and after/ trees. */
function changesFor(caseDir: string): FileChange[] {
  const before = filesUnder(join(caseDir, "before"));
  const after = filesUnder(join(caseDir, "after"));
  const changes: FileChange[] = [];
  for (const path of new Set([...before.keys(), ...after.keys()])) {
    const b = before.get(path);
    const a = after.get(path);
    if (b === a) continue;
    const status = b === undefined ? "added" : a === undefined ? "deleted" : "modified";
    changes.push({
      path,
      status,
      kind: classifyPath(path),
      ...(b !== undefined && { before: b }),
      ...(a !== undefined && { after: a }),
    });
  }
  return changes;
}

const cases = readdirSync(ROOT).flatMap((group) =>
  readdirSync(join(ROOT, group)).map((name) => ({ id: `${group}/${name}`, dir: join(ROOT, group, name) })),
);

describe("fixtures", () => {
  it("has at least one positive and one negative fixture per implemented rule", () => {
    const groups = new Set(cases.map((c) => c.id.split("/")[0]));
    expect(groups).toContain("negative");
    for (const rule of ["POD001", "POD002", "POD003", "POD004", "POD005"]) expect(groups).toContain(rule);
  });

  it.each(cases)("$id", async ({ dir }) => {
    const expected = JSON.parse(readFileSync(join(dir, "expected.json"), "utf8")) as { verdict: string; rules: string[] };
    const result = await verify(changesFor(dir));
    expect(result.verdict).toBe(expected.verdict);
    expect([...new Set(result.findings.map((f) => f.ruleId))].sort()).toEqual([...expected.rules].sort());
  });
});
