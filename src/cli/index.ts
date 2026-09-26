#!/usr/bin/env node
import { Command, Option } from "commander";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { handleClaudeCodeHook, type HookInput } from "../adapters/claude-code.js";
import { defaultCommand, installClaudeCode, uninstallClaudeCode, type Scope } from "../adapters/install.js";
import { gitChangeSet } from "../changeset/git.js";
import { verify } from "../engine.js";
import { humanReport } from "../feedback/format.js";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const program = new Command();

program
  .name("proof-of-done")
  .description("Independently verify a coding agent's 'done' claim.")
  .version(version);

program
  .command("verify")
  .description("Check changes between a base ref and the working tree for test tampering")
  .option("--base <ref>", "git ref to compare against", "HEAD")
  .option("--json", "print the result as JSON")
  .action(async (opts: { base: string; json?: boolean }) => {
    let changes;
    try {
      changes = gitChangeSet(process.cwd(), opts.base);
    } catch (err) {
      const detail = err instanceof Error && "stderr" in err ? String(err.stderr).trim() : String(err);
      console.error(`proof-of-done: could not read git changes against "${opts.base}"${detail ? `\n${detail}` : ""}`);
      process.exitCode = 2;
      return;
    }
    const result = await verify(changes);
    console.log(opts.json ? JSON.stringify(result, null, 2) : humanReport(result));
    if (result.verdict === "FAIL") process.exitCode = 1;
  });

program
  .command("install")
  .description("Install Proof of Done as agent hooks")
  .argument("<agent>", "agent to install for (claude-code)")
  .addOption(new Option("--scope <scope>", "where to write Claude Code settings").choices(["project", "local"]))
  .option("--command <cmd>", "command Claude Code should run (default: detected)")
  .action((agent: string, opts: { scope?: Scope; command?: string }) => {
    if (agent !== "claude-code") {
      console.error(`proof-of-done: unsupported agent "${agent}" (supported: claude-code)`);
      process.exitCode = 2;
      return;
    }
    const detected = defaultCommand(fileURLToPath(import.meta.url));
    const file = installClaudeCode(process.cwd(), opts.command ?? detected.command, opts.scope ?? detected.scope);
    console.log(`Installed Claude Code hooks (SessionStart, Stop) in ${file}`);
    console.log("Claude Code will now be asked to fix tampered tests (deleted, skipped, emptied or faked) before it can finish.");
  });

program
  .command("uninstall")
  .description("Remove Proof of Done agent hooks")
  .argument("<agent>", "agent to uninstall from (claude-code)")
  .action((agent: string) => {
    if (agent !== "claude-code") {
      console.error(`proof-of-done: unsupported agent "${agent}" (supported: claude-code)`);
      process.exitCode = 2;
      return;
    }
    const files = uninstallClaudeCode(process.cwd());
    console.log(files.length ? `Removed Proof of Done hooks from ${files.join(", ")}` : "No Proof of Done hooks found.");
  });

program
  .command("hook", { hidden: true })
  .argument("<agent>")
  .description("Hook entry point, called by the agent (reads hook JSON on stdin)")
  .action(async (agent: string) => {
    if (agent !== "claude-code") return;
    let input: HookInput = {};
    try {
      input = JSON.parse((await readStdin()) || "{}") as HookInput;
    } catch {
      // malformed input: do nothing rather than block the agent
    }
    const out = await handleClaudeCodeHook(input);
    if (out.stderr) process.stderr.write(out.stderr + "\n");
    if (out.stdout) process.stdout.write(out.stdout + "\n");
  });

await program.parseAsync();
