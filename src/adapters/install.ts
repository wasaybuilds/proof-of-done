import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { hashPackage, launcherSource } from "./launcher.js";

export type Scope = "project" | "local";

type HookEntry = { type: "command"; command: string; timeout?: number };
type HookGroup = { matcher?: string; hooks: HookEntry[] };
type Settings = { hooks?: Record<string, HookGroup[]>; [key: string]: unknown };

const EVENTS = ["SessionStart", "Stop"] as const;
/** Identifies our hook entries: the launcher, or the direct command used by 0.2.x and --command. */
const MARKERS = ["proof-of-done.mjs", "hook claude-code"];
export const LAUNCHER_PATH = join(".claude", "hooks", "proof-of-done.mjs");
export const LAUNCHER_COMMAND = 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/proof-of-done.mjs"';

export const settingsPath = (repo: string, scope: Scope): string =>
  join(repo, ".claude", scope === "local" ? "settings.local.json" : "settings.json");

const isOurs = (h: HookEntry): boolean => MARKERS.some((m) => h.command.includes(m));

/**
 * Where the launcher finds the package. Inside the project (installed as a dependency) the path is relative,
 * so .claude/ can be committed and shared; anywhere else it's this machine's absolute path, hence "local" scope.
 */
export function packageRef(repo: string, pkgRoot: string): { pkg: string; scope: Scope } {
  const rel = relative(resolve(repo), resolve(pkgRoot));
  const inside = rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
  return inside
    ? { pkg: rel.split("\\").join("/"), scope: "project" }
    : { pkg: resolve(pkgRoot).split("\\").join("/"), scope: "local" };
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
    const kept = groups.map((g) => ({ ...g, hooks: g.hooks.filter((h) => !isOurs(h)) })).filter((g) => g.hooks.length > 0);
    if (kept.length) hooks[event] = kept;
  }
  const rest: Settings = { ...settings };
  delete rest.hooks;
  return Object.keys(hooks).length ? { ...rest, hooks } : rest;
}

export interface InstallResult {
  settings: string;
  launcher: string;
  scope: Scope;
}

/**
 * Registers SessionStart and Stop hooks that run the launcher in .claude/hooks/, which verifies the
 * package's fingerprint before running it. `command` overrides the hook command (the launcher is still written).
 */
export function installClaudeCode(repo: string, pkgRoot: string, opts: { scope?: Scope; command?: string } = {}): InstallResult {
  const ref = packageRef(repo, pkgRoot);
  const scope = opts.scope ?? ref.scope;
  const version = (JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as { version: string }).version;

  const launcher = join(repo, LAUNCHER_PATH);
  mkdirSync(dirname(launcher), { recursive: true });
  writeFileSync(launcher, launcherSource({ pkg: ref.pkg, version, sha256: hashPackage(pkgRoot) }));

  const file = settingsPath(repo, scope);
  const settings = withoutOurs(load(file));
  const hooks = { ...(settings.hooks ?? {}) };
  const command = opts.command ?? LAUNCHER_COMMAND;
  for (const event of EVENTS) {
    hooks[event] = [...(hooks[event] ?? []), { hooks: [{ type: "command", command, timeout: 60 }] }];
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ ...settings, hooks }, null, 2) + "\n");
  ensureGitignored(repo);
  return { settings: file, launcher, scope };
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
  const launcher = join(repo, LAUNCHER_PATH);
  if (existsSync(launcher)) {
    rmSync(launcher);
    changed.push(launcher);
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
