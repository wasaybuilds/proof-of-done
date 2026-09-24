# Integrations

All adapters call the same engine: `proof-of-done verify`. They differ only in *when* it runs and *how* the result reaches the agent or human.

## Claude Code (Stop hook) — v0.1

When the agent tries to finish, the hook runs a static verification. On `FAIL`, it blocks the stop and gives the agent the feedback, so the agent keeps working.

Installed by `npx proof-of-done install claude-code`, which adds to `.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "npx proof-of-done hook claude-code" }
        ]
      }
    ]
  }
}
```

Hook output on failure:

```json
{ "decision": "block", "reason": "Proof of Done: you deleted test 'rejects expired token' (tests/auth.test.ts). Restore it and fix the bug in src/auth.ts instead." }
```

Loop safety: after `maxBlocksPerSession` (default 3) blocks, the hook stops blocking and prints the report for the human.

## git pre-push — v0.1
`npx proof-of-done install git` adds a `pre-push` hook running `verify --base origin/<default-branch>`.

## GitHub Action — v0.2
Full verification (static + test re-run) on every PR, posts a check run with the verdict and uploads the receipt as an artifact.

```yaml
- uses: proof-of-done/action@v0
  with:
    base: ${{ github.event.pull_request.base.sha }}
```

## Cursor, Codex, others — v0.3
Use each tool's hook system where it exists; otherwise rely on the git or CI adapter.
