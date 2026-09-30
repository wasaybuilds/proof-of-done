import type { FileChange, Finding, Rule } from "../types.js";

/** Marker present in every Proof of Done hook command and launcher. */
export const OUR_HOOK = /proof-of-done/;
const LAUNCHER = /^\.claude\/hooks\/proof-of-done\.mjs$/;

/** What was tampered with, or undefined if the change is harmless. */
function tampering(change: FileChange): string | undefined {
  const path = change.oldPath ?? change.path;
  const removedOrEdited = change.status !== "added";

  switch (change.kind) {
    case "ci":
      return removedOrEdited ? `CI config ${change.status}` : undefined;
    case "policy":
      return removedOrEdited ? `Proof of Done config ${change.status}` : undefined;
    case "agent-config":
      if (LAUNCHER.test(path)) return removedOrEdited ? `Proof of Done launcher ${change.status}` : undefined;
      if (path.includes("/hooks/")) return undefined; // other people's hook scripts are none of our business
      // settings(.local).json: flag only when our hooks were there and aren't any more
      if (change.before && OUR_HOOK.test(change.before) && !(change.after && OUR_HOOK.test(change.after))) {
        return "Proof of Done hooks removed from Claude Code settings";
      }
      return undefined;
    default:
      return undefined;
  }
}

/** Changes to the setup that checks the work: CI workflows, Proof of Done's config, its hooks and launcher. */
export const guardrailModified: Rule = {
  id: "POD008",
  name: "guardrail-modified",
  severity: "block",
  check(ctx) {
    const findings: Finding[] = [];
    for (const { change } of ctx.files) {
      const what = tampering(change);
      if (!what) continue;
      const path = change.oldPath ?? change.path;
      findings.push({
        ruleId: this.id,
        severity: this.severity,
        file: path,
        message: what,
        agentHint: `You changed ${path}, which is part of the setup that checks this work (${what}). Revert it.`,
      });
    }
    return findings;
  },
};
