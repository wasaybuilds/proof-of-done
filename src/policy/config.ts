import { execFileSync } from "node:child_process";
import { parse } from "yaml";

/** How to run the project's tests so the result can be read as JUnit XML. */
export interface TestsConfig {
  /** Shell command. `{junit}` is replaced with a path Proof of Done chooses for the JUnit XML report. */
  command: string;
  /** Where the command writes JUnit XML, relative to the repository root, when `{junit}` can't be used. */
  junitPath?: string;
  timeoutSeconds: number;
}

export interface Config {
  tests?: TestsConfig;
}

export const CONFIG_FILES = [".proofofdone.yml", ".proofofdone.yaml"];
export const DEFAULT_TEST_TIMEOUT = 300;
/** Leaves room inside Claude Code's 600 s Stop hook timeout for the static checks. */
export const MAX_TEST_TIMEOUT = 540;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Parse and validate `.proofofdone.yml`. Throws with a readable message when it's invalid. Unknown keys are ignored. */
export function parseConfig(text: string): Config {
  const raw: unknown = parse(text) ?? {};
  if (!isObject(raw)) throw new Error("expected a mapping at the top level");
  if (raw.version !== undefined && raw.version !== 0) throw new Error(`unsupported version ${String(raw.version)} (expected 0)`);
  if (raw.tests === undefined) return {};
  if (!isObject(raw.tests)) throw new Error("tests: expected a mapping");

  const { command, junitPath, timeoutSeconds = DEFAULT_TEST_TIMEOUT } = raw.tests;
  if (typeof command !== "string" || !command.trim()) throw new Error("tests.command: expected a command");
  if (junitPath !== undefined && (typeof junitPath !== "string" || !junitPath.trim())) throw new Error("tests.junitPath: expected a path");
  if (!command.includes("{junit}") && junitPath === undefined) {
    throw new Error("tests: put {junit} in the command where the JUnit XML report should go, or set junitPath");
  }
  if (typeof timeoutSeconds !== "number" || !(timeoutSeconds > 0 && timeoutSeconds <= MAX_TEST_TIMEOUT)) {
    throw new Error(`tests.timeoutSeconds: expected a number of seconds up to ${MAX_TEST_TIMEOUT}`);
  }
  return { tests: { command, timeoutSeconds, ...(junitPath !== undefined && { junitPath }) } };
}

/**
 * The config as it is in `base`, never the working tree: an agent can't weaken its own checks
 * (editing the file is reported by POD008). No file means no config.
 */
export function loadConfig(cwd: string, base: string): Config {
  for (const file of CONFIG_FILES) {
    let text: string;
    try {
      text = execFileSync("git", ["show", `${base}:${file}`], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      continue; // not in base
    }
    try {
      return parseConfig(text);
    } catch (err) {
      throw new Error(`${file}: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }
  return {};
}
