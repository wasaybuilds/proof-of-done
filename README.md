# Proof of Done

[![npm](https://img.shields.io/npm/v/proof-of-done)](https://www.npmjs.com/package/proof-of-done)
[![CI](https://github.com/wasaybuilds/proof-of-done/actions/workflows/ci.yml/badge.svg)](https://github.com/wasaybuilds/proof-of-done/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Status: pre-alpha](https://img.shields.io/badge/status-pre--alpha-orange)
![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)

**Your coding agent says "done, all tests pass." Proof of Done checks whether that's true.**

Coding agents (Claude Code, Cursor, Codex, Devin, …) regularly report success when the work isn't finished. Sometimes the tests really fail. Sometimes the tests "pass" because the agent deleted the failing one, added `.skip`, removed an assertion, or hardcoded the expected value.

Proof of Done looks at **what changed**, not at what the agent reported.

## What it does today

`proof-of-done verify` compares your working tree against a git ref and flags test tampering:

| Rule | Detects | Languages |
|---|---|---|
| **POD001** test-deleted | Tests or whole test files removed | JS / TS / TSX, Python |
| **POD002** test-skipped | `.skip`, `xit`, `todo`, `@pytest.mark.skip`, `pytest.skip()`, newly added `.only` | JS / TS / TSX, Python |
| **POD003** assertion-removed | Fewer assertions in a test than before, including commented-out asserts | JS / TS / TSX, Python |
| **POD004** assertion-weakened | A specific check replaced by a weaker one: `toBe(120)` → `toBeDefined()`, `assertEqual` → `assertTrue`, `== 3` → `> 0` (warning) | JS / TS / TSX, Python |
| **POD005** vacuous-assertion | Assertions that can't fail: `expect(true).toBe(true)`, `assert True`, `x == x`, asserts swallowed by `try/catch` | JS / TS / TSX, Python |

It's built not to punish normal refactoring: renamed and moved tests are recognised, and when a change adds at least as many assertions as it removes, findings are warnings rather than failures. See [how refactors are handled](docs/DETECTION-RULES.md#refactor-vs-cheat-applies-to-pod001-and-pod003).

Everything is deterministic code (git + syntax trees). **No LLM is called**, so a check costs nothing and takes about a second.

Real output, after deleting a test and an assertion:

```
✗ FAIL  2 blocking, 0 warning

POD001  block  src/math.test.ts  removed test "rejects NaN" (was line 6)
POD003  block  src/math.test.ts:2  1 assertion removed from "adds" (2 → 1)

→ to agent: You deleted test "rejects NaN" in src/math.test.ts. Restore it and fix the code under test instead. You removed 1 assertion(s) from "adds" in src/math.test.ts. Restore them and fix the code instead.
```

Exit codes: `0` PASS or SUSPICIOUS, `1` FAIL, `2` could not read git changes.

### In Claude Code

`proof-of-done install claude-code` adds a Stop hook: when Claude tries to finish, Proof of Done checks everything changed since the session started. If a test was deleted, skipped, had assertions removed or was filled with assertions that can't fail, Claude is sent back to fix it, with the exact instruction:

```json
{"decision":"block","reason":"Proof of Done: You deleted test \"subtracts\" in tests/math.test.ts. Restore it and fix the code under test instead."}
```

It stops blocking after 3 attempts, never blocks on a mere warning, and lets Claude stop if anything goes wrong. Details: [Integrations](docs/INTEGRATIONS.md#claude-code-available).

## Quick start

Requires Node ≥ 20 and git. Run inside the repo you want to check:

```bash
npx proof-of-done verify               # uncommitted changes vs HEAD
npx proof-of-done verify --base main   # everything on this branch
npx proof-of-done verify --json        # machine-readable
```

**With Claude Code**, install it in your project and add the hooks:

```bash
npm install --save-dev proof-of-done
npx proof-of-done install claude-code   # writes .claude/settings.json; commit it to share with your team
```

<details>
<summary>From source</summary>

```bash
git clone https://github.com/wasaybuilds/proof-of-done.git
cd proof-of-done && npm ci && npm run build
node dist/cli/index.js verify
```
</details>

## Where it's going

- **Re-run the tests** in a clean, isolated checkout and compare with what the agent claimed
- **More rules**, prioritised by real incidents: hardcoded answers, CI and test-config edits, early exits, test-result hooks ([full list](docs/DETECTION-RULES.md))
- **More adapters**: git pre-push, GitHub Action, Cursor and Codex
- **Signed receipts** that other tools (CI, reviewers, agent marketplaces) can trust

Progress: [docs/ROADMAP.md](docs/ROADMAP.md).

## Documentation

| Doc | What's in it |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | Components, data flow, tech stack, design decisions |
| [Detection rules](docs/DETECTION-RULES.md) | Every cheat pattern, with examples and evidence |
| [Receipt spec](docs/RECEIPT-SPEC.md) | The planned signed receipt format |
| [Integrations](docs/INTEGRATIONS.md) | Claude Code hooks (available); planned git and GitHub Actions adapters |
| [Configuration](docs/CONFIGURATION.md) | Planned `.proofofdone.yml` reference |
| [Roadmap](docs/ROADMAP.md) | Phases, milestones, success criteria |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The most valuable contribution right now: **real examples of an agent cheating on tests** ([open a case report](https://github.com/wasaybuilds/proof-of-done/issues/new?template=case-report.md)). They become detection rules and test fixtures.

## License

MIT — see [LICENSE](LICENSE).
