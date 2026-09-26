import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export type Scope = "project" | "local";

type HookEntry = { type: "command"; command: string; timeout?: number };
type HookGroup = { matcher?: string; hooks: HookEntry[] };
type Settings = { hooks?: Record<string, HookGroup[]>; [key: string]: unknown };

const EVENTS = ["SessionStart", "Stop"] as const;
const MARKER = "hook claude-code";

export const settingsPath = (repo: string, scope: Scope): string =>
  join(repo, ".claude", scope === "local" ? "settings.local.json" : "settings.json");

/**
 * The command Claude Code should run. Inside a project that has proof-of-done installed
 * (node_modules), use the portable npx form; otherwise point at this CLI's absolute path,
 * which only makes sense on this machine — hence the default "local" scope for that case.
 */
export function defaultCommand(cliPath: string): { command: string; scope: Scope } {
  if (/[\\/]node_modules[\\/]/.test(cliPath)) return { command: `npx --no-install proof-of-done ${MARKER}`, scope: "project" };
  return { command: `node "${resolve(cliPath).replace(/\\/g, "/")}" ${MARKER}`, scope: "local" };
}

function load(file: string): Settings {
  if (!existsSync(file)) return {};
  const text = readFileSync(file, "utf8").trim();
  return text ? (JSON.parse(text) as Settings) : {};
}

/** Remove our hook entries, keeping everything else the user configured. */
function withoutOurs(settings: Settings): Settings {
  const hooks: Record<string, HookGroup[]> = {};
  for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
    const kept = groups
      .map((g) => ({ ...g, hooks: g.hooks.filter((h) => !h.command.includes(MARKER)) }))
      .filter((g) => g.hooks.length > 0);
    if (kept.length) hooks[event] = kept;
  }
  const rest: Settings = { ...settings };
  delete rest.hooks;
  return Object.keys(hooks).length ? { ...rest, hooks } : rest;
}

export function installClaudeCode(repo: string, command: string, scope: Scope): string {
  const file = settingsPath(repo, scope);
  const settings = withoutOurs(load(file));
  const hooks = { ...(settings.hooks ?? {}) };
  for (const event of EVENTS) {
    hooks[event] = [...(hooks[event] ?? []), { hooks: [{ type: "command", command, timeout: 60 }] }];
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ ...settings, hooks }, null, 2) + "\n");
  ensureGitignored(repo);
  return file;
}

export function uninstallClaudeCode(repo: string): string[] {
  const changed: string[] = [];
  for (const scope of ["project", "local"] as const) {
    const file = settingsPath(repo, scope);
    if (!existsSync(file)) continue;
    const before = load(file);
    const after = withoutOurs(before);
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    writeFileSync(file, JSON.stringify(after, null, 2) + "\n");
    changed.push(file);
  }
  return changed;
}

/** Session state lives in .proof-of-done/ and must never be committed. */
function ensureGitignored(repo: string): void {
  const file = join(repo, ".gitignore");
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (/^\/?\.proof-of-done\/?\s*$/m.test(current)) return;
  const sep = current && !current.endsWith("\n") ? "\n" : "";
  writeFileSync(file, `${current}${sep}.proof-of-done/\n`);
}
