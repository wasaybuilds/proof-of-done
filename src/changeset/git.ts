import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChangeStatus, FileChange } from "../types.js";
import { classifyPath } from "./classify.js";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

const STATUS: Record<string, ChangeStatus> = { A: "added", M: "modified", D: "deleted", R: "renamed", T: "modified" };

/** Kinds whose contents the rules need. Source files are only classified, never read. */
const LOAD_CONTENT = new Set<FileChange["kind"]>(["test", "ci", "policy", "agent-config"]);

/** Changes between `base` and the working tree (committed, staged, unstaged and untracked). */
export function gitChangeSet(cwd: string, base: string): FileChange[] {
  git(cwd, ["rev-parse", "--verify", "--quiet", `${base}^{commit}`]);

  const fields = git(cwd, ["diff", "--name-status", "-M", "-z", base, "--"]).split("\0").filter(Boolean);
  const entries: { status: ChangeStatus; path: string; oldPath?: string }[] = [];
  for (let i = 0; i < fields.length; ) {
    const code = fields[i++]?.[0] ?? "";
    const status = STATUS[code];
    if (code === "R") {
      const oldPath = fields[i++] ?? "";
      const path = fields[i++] ?? "";
      entries.push({ status: "renamed", path, oldPath });
    } else {
      const path = fields[i++] ?? "";
      if (status) entries.push({ status, path });
    }
  }
  // A file in `base` that isn't tracked now (base can be a snapshot that included untracked files) is listed
  // as deleted by the diff and again as untracked. It's one file: modified, or unchanged.
  for (const path of git(cwd, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean)) {
    const listed = entries.find((e) => e.status === "deleted" && e.path === path);
    if (listed) listed.status = "modified";
    else entries.push({ status: "added", path });
  }

  return entries
    .map(({ status, path, oldPath }) => {
      const change: FileChange = { status, path, kind: classifyPath(path), ...(oldPath && { oldPath }) };
      if (!LOAD_CONTENT.has(change.kind)) return change;
      if (status !== "added") change.before = git(cwd, ["show", `${base}:${oldPath ?? path}`]);
      const abs = join(cwd, path);
      if (status !== "deleted" && existsSync(abs)) change.after = readFileSync(abs, "utf8");
      return change;
    })
    .filter((c) => c.status === "renamed" || c.before === undefined || c.before !== c.after);
}
