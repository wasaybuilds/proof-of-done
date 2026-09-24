# Proof of Done

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Status: pre-alpha](https://img.shields.io/badge/status-pre--alpha-orange)
![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)

**Your coding agent says "done, all tests pass." Proof of Done checks whether that's true.**

Coding agents (Claude Code, Cursor, Codex, Devin, …) regularly report success when the work isn't finished. Sometimes the tests really fail. Sometimes the tests "pass" because the agent deleted the failing one, added `.skip`, removed an assertion, or hardcoded the expected value.

Proof of Done is an independent verifier that runs **outside the agent's control** at the moment the agent claims it's finished:

1. **Re-runs the real tests** in a clean, isolated checkout — never trusts the agent's summary.
2. **Detects test tampering** by diffing before vs. after: deleted/skipped tests, removed or weakened assertions, swallowed errors, hardcoded answers, lowered coverage thresholds.
3. **Checks scope** — did the agent touch files it wasn't supposed to (CI config, test config, protected paths)?
4. **Issues a signed receipt** — `PASS`, `SUSPICIOUS`, or `FAIL` — and, on failure, hands the agent a short (~50 token) instruction to fix the real problem.

> Status: **pre-alpha.** `verify` detects deleted tests, skipped tests and removed assertions (JS/TS + Python). Test re-runs, receipts and agent hooks are in progress — see [docs/ROADMAP.md](docs/ROADMAP.md).

## Why it's cheap

~95% of checks are deterministic code (git diffs + syntax trees). **No LLM is called by default.** An optional LLM judge only sees the few suspicious lines, never the whole repo. Proof of Done *saves* tokens by catching fake "done" before it costs a whole new debugging session.

## How it will be used

```bash
# one-off check
npx proof-of-done verify              # uncommitted changes vs HEAD
npx proof-of-done verify --base main  # everything on this branch

# as a Claude Code Stop hook: agent can't finish until verification passes
npx proof-of-done install claude-code
```

Example output:

```
✗ FAIL  2 blocking findings

POD001 test-deleted        tests/auth.test.ts  removed test "rejects expired token"
POD003 assertion-removed   tests/cart.test.ts  3 assertions removed, 0 added

→ to agent: "You deleted test 'rejects expired token' and removed 3 assertions in
  cart.test.ts. Restore them and fix the underlying bug instead."

receipt: .proof-of-done/receipts/2026-09-24T10-12-03Z.json (signed)
```

## Documentation

| Doc | What's in it |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | Components, data flow, tech stack, design decisions |
| [Detection rules](docs/DETECTION-RULES.md) | Every cheat pattern we detect, with examples |
| [Receipt spec](docs/RECEIPT-SPEC.md) | The signed verification receipt format |
| [Integrations](docs/INTEGRATIONS.md) | Claude Code, Cursor, git hooks, GitHub Actions |
| [Configuration](docs/CONFIGURATION.md) | `.proofofdone.yml` reference |
| [Roadmap](docs/ROADMAP.md) | Phases, milestones, success criteria |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The most valuable contribution right now: **real examples of an agent cheating on tests** — they become detection rules and case studies.

## License

MIT — see [LICENSE](LICENSE).
