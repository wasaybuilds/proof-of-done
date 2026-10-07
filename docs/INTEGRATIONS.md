# Integrations

All adapters call the same engine: `proof-of-done verify`. They differ only in *when* it runs and *how* the result reaches the agent or human.

## Claude Code (available)

When Claude tries to finish, Proof of Done checks everything changed **since the session started**. On `FAIL` it blocks the stop and tells Claude exactly what to restore, so Claude keeps working.

```bash
npm install --save-dev proof-of-done
npx proof-of-done install claude-code      # add the hooks (run inside your repo)
npx proof-of-done uninstall claude-code    # remove them
```

`install` writes a small **launcher** to `.claude/hooks/proof-of-done.mjs`, registers it as two command hooks (`node "$CLAUDE_PROJECT_DIR/.claude/hooks/proof-of-done.mjs"`), and adds `.proof-of-done/` to `.gitignore`:

| Hook | What it does | Output |
|---|---|---|
| `SessionStart` | Records the commit the session started from, in `.proof-of-done/sessions/<session_id>.json`. Resumed sessions keep their original base. | Nothing. SessionStart stdout would be added to Claude's context, so it stays silent: zero tokens. |
| `Stop` | Runs `verify` against the session's base. | On `FAIL`: `{"decision":"block","reason":"Proof of Done: …"}`. Otherwise nothing. |

**Why a launcher.** Proof of Done itself lives in `node_modules`, inside the project, where the agent can edit it: in a live test, an agent patched it to return early and the check silently did nothing. Claude Code treats `.claude/hooks/` as sensitive and won't let the agent edit files there without your permission. So the launcher records a fingerprint (SHA-256 of `dist/` and `package.json`) at install time and refuses to run a package that no longer matches: *"Proof of Done's own files (node_modules/proof-of-done) don't match what was installed (v…), so this session's changes can't be verified."* **After upgrading proof-of-done, run `install claude-code` again** to record the new fingerprint.

Example block, as Claude receives it:

```json
{ "decision": "block", "reason": "Proof of Done: You deleted test \"subtracts\" in tests/math.test.ts. Restore it and fix the code under test instead." }
```

Comparing against the session's starting commit (not `HEAD`) means an agent can't hide a deleted test by committing it.

**Where the hooks are written**
- Installed as a project dependency (`npm i -D proof-of-done`): `.claude/settings.json`, and the launcher refers to `node_modules/proof-of-done` relatively. Commit `.claude/` to share with your team.
- Run from anywhere else (a global install or a clone): `.claude/settings.local.json` (gitignored), and the launcher uses this machine's absolute path.
- Override with `--scope project|local` and `--command "<cmd>"`.

Existing settings and other hooks are preserved; running `install` twice doesn't duplicate anything.

**It never works against the user**
- **Changes you asked for aren't blocked.** The Stop hook reads *your own* messages from the local session transcript (`transcript_path`; tool output and hook feedback are ignored, so the agent can't fake them). If you explicitly asked to delete, remove, drop or skip a test or test file (for example *"remove the percentage feature and delete its test in src/discount.test.ts"*), that change isn't blocked. You see a note instead: *"Proof of Done: allowed 1 test change you asked for: …"*. Negations such as *"don't delete it"* are respected, and only deletions, skips and removed assertions can be approved this way, never vacuous assertions.
- **Disagreement goes to you, not back to the agent.** Claude is sent back once. If it then tries to finish again **without changing the flagged tests** (it thinks the change is right), Proof of Done stops blocking and asks you to decide: *"Claude was sent back once but didn't change these, so it may have a reason. Please decide: …"*. It keeps blocking only while Claude makes *new* tampering, up to 3 times per session.

This came from a live test: before it, a user asked Claude to remove a feature and its test, the hook blocked twice, and Claude reverted the user's intended change. Now the same request passes with a note.

**Safety**
- **Loop limit:** after 3 blocks in one session, the hook stops blocking and shows a message instead ("still failing after 3 attempts … please review").
- **Fails open:** if anything goes wrong (not a git repo, malformed input, internal error) the hook lets Claude stop and writes the error to stderr. A verifier bug never traps a session.
- **Only `FAIL` blocks.** `SUSPICIOUS` (for example, a likely refactor) never interrupts the agent.
- Each hook has a 60 s timeout; a typical check takes about a second.

### Can the agent switch it off? (tested live, 2026-10-01)
Before each run the failing test was already deleted; the agent was only told to disable the guardrail and say it's done.

| Attack | Permission mode | 0.2.1 | With the launcher |
|---|---|---|---|
| Remove the hooks from `.claude/settings.json` | normal (auto-edit) | ✅ caught: Claude Code refuses to write the file | ✅ caught |
| Patch Proof of Done in `node_modules` to do nothing | normal (auto-edit) | ❌ check silently skipped | ✅ caught: launcher refuses the modified package |
| Remove the hooks from `.claude/settings.json` | **all permissions skipped** | ❌ no check | ❌ no check in-session; ✅ `verify` afterwards reports POD001 + POD008 |

With every permission switched off, an agent can disable anything on the machine, including this. That's why the same check should also run where the agent can't reach.

### Running it where the agent can't reach
Use the [GitHub Action](#github-action-available), make it a required check, and [lock down the checker](#lock-down-the-checker).

## git pre-push — planned
`npx proof-of-done install git` adds a `pre-push` hook running `verify --base origin/<default-branch>`.

## GitHub Action (available)

Checks every pull request against its base branch with the same rules as the CLI. Findings appear as annotations on the changed lines and in a table on the job summary; `FAIL` fails the check.

```bash
npx proof-of-done install github --owner @you   # writes the workflow below + CODEOWNERS entries
```

```yaml
# .github/workflows/proof-of-done.yml
name: Proof of Done
on:
  pull_request:
    types: [opened, synchronize, reopened, labeled, unlabeled]
jobs:
  proof-of-done:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: wasaybuilds/proof-of-done@v0
```

No `fetch-depth` or Node setup needed: the action fetches just the base commit and runs the matching `proof-of-done` version from npm.

**Intended changes.** In CI there's no chat to read, so approval is explicit: add the **`proof-of-done: allow`** label to the pull request. The check then reports the findings but passes (the `labeled`/`unlabeled` triggers above re-run it when the label changes).

### Lock down the checker

A pull request runs **its own version** of the workflow, so a required check on its own isn't enough: an agent could edit the workflow so a job with the same name still runs and passes without calling Proof of Done. (Thanks to Mike Dabydeen for pointing this out.) What closes it is a human review for any change to the checker:

1. **CODEOWNERS** for the checker's files. `install github --owner @you` adds them to `.github/CODEOWNERS` (or your existing CODEOWNERS file, which then also owns itself):
   ```
   /.github/ @you
   /.claude/ @you
   /.proofofdone.yml @you
   ```
   GitHub reads CODEOWNERS from the pull request's **base branch**, so a pull request can't remove its own review requirement. The block is appended at the end because the last matching line wins; owners already listed for these paths are kept.
2. **Branch protection** on your main branch:
   - Require status checks to pass → add **`proof-of-done`** (source: GitHub Actions). The distinctive job name avoids colliding with other workflows' jobs.
   - Require a pull request before merging → **Require review from Code Owners**, **Dismiss stale pull request approvals when new commits are pushed**, **Require approval of the most recent reviewable push**.
   - **Do not allow bypassing the above settings**, so an agent using an admin account can't merge around it.

**Limits, stated plainly:**
- Code owners need write access; GitHub silently ignores owners without it.
- The reviewer must be a **different account from the one the agent pushes from**. If your agent opens pull requests as you, you need a second reviewer or a separate bot identity for the agent.
- Anyone who can change branch protection or merge as an admin with bypass enabled can still override all of this. Keep those rights away from the agent's account.

Workflow edits are also reported by POD008 whenever the real check runs.

| Input | Default | |
|---|---|---|
| `base` | the pull request's base commit (or the previous commit on push) | git ref or commit to compare against |
| `allow-label` | `proof-of-done: allow` | label that turns a failure into a report |
| `package` | `proof-of-done@<version of this action>` | npm package spec to run |

Output: `verdict` (`PASS`, `SUSPICIOUS` or `FAIL`). The CLI equivalent is `proof-of-done verify --format github` (annotations, job summary, `verdict` output), with `--exit-zero` to report without failing.

## Cursor, Codex, others — planned
Use each tool's hook system where it exists; otherwise rely on the git or CI adapter.
