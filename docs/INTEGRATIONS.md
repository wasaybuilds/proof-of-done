# Integrations

All adapters call the same engine: `proof-of-done verify`. They differ only in *when* it runs and *how* the result reaches the agent or human.

## Claude Code (available)

When Claude tries to finish, Proof of Done checks everything changed **since the session started**. On `FAIL` it blocks the stop and tells Claude exactly what to restore, so Claude keeps working.

```bash
proof-of-done install claude-code      # add the hooks (run inside your repo)
proof-of-done uninstall claude-code    # remove them
```

`install` registers two command hooks and adds `.proof-of-done/` to `.gitignore`:

| Hook | What it does | Output |
|---|---|---|
| `SessionStart` | Records the commit the session started from, in `.proof-of-done/sessions/<session_id>.json`. Resumed sessions keep their original base. | Nothing. SessionStart stdout would be added to Claude's context, so it stays silent: zero tokens. |
| `Stop` | Runs `verify` against the session's base. | On `FAIL`: `{"decision":"block","reason":"Proof of Done: …"}`. Otherwise nothing. |

Example block, as Claude receives it:

```json
{ "decision": "block", "reason": "Proof of Done: You deleted test \"subtracts\" in tests/math.test.ts. Restore it and fix the code under test instead." }
```

Comparing against the session's starting commit (not `HEAD`) means an agent can't hide a deleted test by committing it.

**Where the hooks are written**
- Installed as a project dependency (`npm i -D proof-of-done`): `.claude/settings.json`, with the portable command `npx --no-install proof-of-done hook claude-code`. Commit it to share with your team.
- Run from anywhere else (a global install or a clone): `.claude/settings.local.json` (gitignored), with this machine's absolute path.
- Override with `--scope project|local` and `--command "<cmd>"`.

Existing settings and other hooks are preserved; running `install` twice doesn't duplicate anything.

**Safety**
- **Loop limit:** after 3 blocks in one session, the hook stops blocking and shows a message instead ("still failing after 3 attempts … review the changes yourself").
- **Fails open:** if anything goes wrong (not a git repo, malformed input, internal error) the hook lets Claude stop and writes the error to stderr. A verifier bug never traps a session.
- **Only `FAIL` blocks.** `SUSPICIOUS` (for example, a likely refactor) never interrupts the agent.
- Each hook has a 60 s timeout; a typical check takes about a second.

## git pre-push — planned
`npx proof-of-done install git` adds a `pre-push` hook running `verify --base origin/<default-branch>`.

## GitHub Action — planned
Full verification (static + test re-run) on every PR, posts a check run with the verdict and uploads the receipt as an artifact.

```yaml
- uses: proof-of-done/action@v0
  with:
    base: ${{ github.event.pull_request.base.sha }}
```

## Cursor, Codex, others — planned
Use each tool's hook system where it exists; otherwise rely on the git or CI adapter.
