# CLAUDE.md

Guidance for Claude Code (and other coding agents) working in this repository.

## Project
Proof of Done is a CLI that independently verifies a coding agent's "done / tests pass" claim: it re-runs tests in an isolated worktree, detects test tampering by diffing before vs. after, checks scope, and emits a signed receipt. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before making structural changes.

**Status:** pre-alpha. Docs exist; implementation starts in Phase 1 ([docs/ROADMAP.md](docs/ROADMAP.md)).

## Stack
- TypeScript (strict), Node ≥ 20, ESM
- `web-tree-sitter` (WASM) for parsing, `commander` CLI, `zod` config, `execa` for git, `@noble/ed25519` signing
- `vitest` for tests

## Commands
```bash
npm install
npm run lint
npm run typecheck
npm test            # unit + fixture tests
npm run build       # → dist/
```
CI (`.github/workflows/ci.yml`) runs all four on Node 20 and 22 for every PR. All must pass before merging to `main`.

## Layout
```
src/cli  src/changeset  src/policy  src/parse/<lang>  src/rules
src/scope  src/runner  src/judge  src/verdict  src/receipt  src/feedback  src/adapters
fixtures/<RULE-ID>/<case>/{before,after}/   # real before/after pairs
test/
docs/
```

## Non-negotiable rules
1. **Deterministic by default.** No LLM calls on the default path. The judge in `src/judge` is opt-in and receives only relevant hunks.
2. **Policy comes from the base commit**, never the working tree. An agent must not be able to weaken its own checks.
3. **Parse JUnit XML, never console output**, for test results.
4. **Every rule needs ≥ 1 positive and ≥ 1 negative fixture.** False positives are bugs.
5. **Rules are pure functions** `(RuleContext) => Finding[]`; no I/O inside rules.
6. **Nothing leaves the machine by default.** Any network call must be opt-in and recorded in the receipt.
7. **Agent feedback is capped** (≤ 5 findings, ~300 tokens total). Adapters stop blocking after `maxBlocksPerSession`.
8. **Don't weaken tests to make them pass** — this project exists to catch exactly that. Fix the code instead.

## Conventions
- Rule files: `src/rules/PODxxx-kebab-name.ts`; IDs are stable and never reused.
- New rules must be added to [docs/DETECTION-RULES.md](docs/DETECTION-RULES.md) in the same change.
- Receipt format changes must update [docs/RECEIPT-SPEC.md](docs/RECEIPT-SPEC.md) and bump `spec`.
- Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).
- Keep this repo product-only: no marketing, research or business material here.
