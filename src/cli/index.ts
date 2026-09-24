#!/usr/bin/env node
import { Command } from "commander";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };

const program = new Command();

program
  .name("proof-of-done")
  .description("Independently verify a coding agent's 'done' claim.")
  .version(version);

program
  .command("verify")
  .description("Verify changes between a base ref and the working tree")
  .option("--base <ref>", "base git ref", "main")
  .option("--static-only", "skip the test re-run")
  .action(() => {
    console.error("verify: not implemented yet (Phase 1)");
    process.exitCode = 2;
  });

await program.parseAsync();
