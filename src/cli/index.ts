#!/usr/bin/env node
import { Command } from "commander";
import { createRequire } from "node:module";
import { gitChangeSet } from "../changeset/git.js";
import { verify } from "../engine.js";
import { humanReport } from "../feedback/format.js";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };

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

await program.parseAsync();
