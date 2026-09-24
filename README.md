# Proof of Done

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

## Quick start (from source)

Not on npm yet. Requires Node ≥ 20 and git.

```bash
git clone https://github.com/wasaybuilds/proof-of-done.git
cd proof-of-done
npm ci && npm run build

# then, inside the repo you want to check:
node /path/to/proof-of-done/dist/cli/index.js verify               # uncommitted changes vs HEAD
node /path/to/proof-of-done/dist/cli/index.js verify --base main   # everything on this branch
node /path/to/proof-of-done/dist/cli/index.js verify --json        # machine-readable
```

## Where it's going

- **Re-run the tests** in a clean, isolated checkout and compare with what the agent claimed
- **More rules**, prioritised by real incidents: weakened and vacuous assertions, hardcoded answers, CI and test-config edits, early exits, test-result hooks ([full list](docs/DETECTION-RULES.md))
- **Agent hooks**: a Claude Code Stop hook so the agent can't finish until verification passes; git and GitHub Action adapters
- **Signed receipts** that other tools (CI, reviewers, agent marketplaces) can trust
- **`npx proof-of-done`** via npm

Progress: [docs/ROADMAP.md](docs/ROADMAP.md).

## Documentation

| Doc | What's in it |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | Components, data flow, tech stack, design decisions |
| [Detection rules](docs/DETECTION-RULES.md) | Every cheat pattern, with examples and evidence |
| [Receipt spec](docs/RECEIPT-SPEC.md) | The planned signed receipt format |
| [Integrations](docs/INTEGRATIONS.md) | Planned Claude Code, git and GitHub Actions adapters |
| [Configuration](docs/CONFIGURATION.md) | Planned `.proofofdone.yml` reference |
| [Roadmap](docs/ROADMAP.md) | Phases, milestones, success criteria |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The most valuable contribution right now: **real examples of an agent cheating on tests** ([open a case report](https://github.com/wasaybuilds/proof-of-done/issues/new?template=case-report.md)). They become detection rules and test fixtures.

## License

MIT — see [LICENSE](LICENSE).
