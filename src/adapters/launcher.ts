import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Fingerprint of an installed proof-of-done package: every file under dist/ plus package.json.
 * Must stay byte-for-byte identical to `hashPackage` inside LAUNCHER_TEMPLATE below.
 */
export function hashPackage(root: string): string {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(join(root, "dist"));
  files.push(join(root, "package.json"));
  const h = createHash("sha256");
  for (const f of files.map((f) => relative(root, f).split("\\").join("/")).sort()) {
    h.update(f + "\0");
    h.update(readFileSync(join(root, f)));
    h.update("\0");
  }
  return h.digest("hex");
}

export interface LauncherConfig {
  /** Package root, relative to the project (portable) or absolute. */
  pkg: string;
  version: string;
  sha256: string;
}

/**
 * Written to .claude/hooks/proof-of-done.mjs. Claude Code treats files there as sensitive and won't let the
 * agent edit them without the user's permission, so this is the part of Proof of Done the agent can't patch.
 * It refuses to run a package whose files changed since install, which is how an agent would switch it off.
 */
export function launcherSource(config: LauncherConfig): string {
  return LAUNCHER_TEMPLATE.replace("__CONFIG__", JSON.stringify(config));
}

const LAUNCHER_TEMPLATE = `// Proof of Done launcher. Written by \`proof-of-done install claude-code\`: don't edit.
// Claude Code protects .claude/hooks/, so the agent can't change this file. Before running Proof of Done it
// checks that the installed package still matches what was installed; a modified package won't be run.
// After upgrading proof-of-done, run \`npx proof-of-done install claude-code\` again.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const EXPECTED = __CONFIG__;

function hashPackage(root) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(join(root, "dist"));
  files.push(join(root, "package.json"));
  const h = createHash("sha256");
  for (const f of files.map((f) => relative(root, f).split("\\\\").join("/")).sort()) {
    h.update(f + "\\0");
    h.update(readFileSync(join(root, f)));
    h.update("\\0");
  }
  return h.digest("hex");
}

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
let input = {};
try {
  input = JSON.parse(raw || "{}");
} catch {}

const project = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const root = isAbsolute(EXPECTED.pkg) ? EXPECTED.pkg : join(project, EXPECTED.pkg);
let actual = "missing";
try {
  actual = hashPackage(root);
} catch {}

if (actual !== EXPECTED.sha256) {
  if (input.hook_event_name === "Stop") {
    const what = "Proof of Done's own files (" + EXPECTED.pkg + ") don't match what was installed (v" + EXPECTED.version + "), so this session's changes can't be verified.";
    const out = input.stop_hook_active
      ? { systemMessage: what + " If you upgraded or reinstalled proof-of-done, run \`npx proof-of-done install claude-code\` again. Otherwise they were modified during the session." }
      : { decision: "block", reason: what + " Don't modify guardrail files. Restore them (\`npm ci\` or reinstall proof-of-done), then finish." };
    process.stdout.write(JSON.stringify(out) + "\\n");
  }
  process.exit(0);
}

const { handleClaudeCodeHook } = await import(pathToFileURL(join(root, "dist", "adapters", "claude-code.js")).href);
const out = await handleClaudeCodeHook(input);
if (out.stderr) process.stderr.write(out.stderr + "\\n");
if (out.stdout) process.stdout.write(out.stdout + "\\n");
`;
