# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.0] - 2026-10-07

### Added
- **POD008 guardrail-modified** (block): CI workflows or `.proofofdone.yml` edited or deleted, Proof of Done hooks removed from Claude Code settings, or the launcher changed. Catches typia's attempt 3 (CI edited to exclude failing tests). Approvable by explicit user requests like other findings.
- **Tamper-resistant Claude Code hook.** `install claude-code` writes a launcher to `.claude/hooks/proof-of-done.mjs` (a location Claude Code protects from agent edits). It checks a SHA-256 fingerprint of the installed package before every run and refuses a modified package. Found in a live bypass test where an agent patched `node_modules/proof-of-done` to return early. Re-run `install claude-code` after upgrading.
- Docs: how to run `verify` as a required CI check, and the live bypass test results.

### Changed
- Hook command is now `node "$CLAUDE_PROJECT_DIR/.claude/hooks/proof-of-done.mjs"`; re-running `install` replaces 0.2.x entries.
- Package smoke test also installs the hooks, runs the launcher, and checks it refuses a tampered package.

## [0.2.1] - 2026-09-27

### Changed
- **Claude Code hook respects the user.** Test deletions, skips and removed assertions the user explicitly asked for in the session (read from the local transcript, user messages only) are no longer blocked; the user gets a note instead. If Claude is sent back once and tries to finish again without changing the flagged tests, the hook hands the decision to the user instead of blocking again. Found in a live Claude Code test where a requested feature removal was reverted after two blocks.
- **Install size: 22 MB → 4.2 MB.** The package now ships only the tree-sitter runtime and the four grammars it uses (TypeScript, TSX, JavaScript, Python) instead of depending on `@vscode/tree-sitter-wasm`, which includes 17 languages. Licences in `THIRD_PARTY_NOTICES.md`.
- CI and releases run a package smoke test: the packed tarball is installed into a clean project and must detect tampering there, within an 8 MB size budget.

## [0.2.0] - 2026-09-26

### Added
- **POD004 assertion-weakened** (warn): a specific check replaced by a weaker one in the same test, e.g. `toBe(120)` → `toBeDefined()`, `assertEqual` → `assertTrue`, `== 3` → `> 0`, `toThrow("expired")` → `toThrow()`.
- **POD005 vacuous-assertion** (block): assertions that can't fail were added, e.g. `expect(true).toBe(true)`, `assert True`, `x == x`, or assertions swallowed by `try/catch` / `try/except`.
- Assertion strength (exact / weak / vacuous) for JS/TS and Python.

### Changed
- Vacuous assertions no longer count as test strength when deciding whether a removal is a refactor, so padding a change with `expect(true).toBe(true)` no longer turns a deleted test into a warning.
- Releases are published with npm trusted publishing (OIDC) instead of a stored token. Provenance is attached automatically.

### Fixed
- Files declaring the same test name twice: tests are now matched to their own counterpart instead of the last one with that name, which caused false findings.

## [0.1.0] - 2026-09-26

First release.

### Added
- **Claude Code hooks**: `install claude-code` / `uninstall claude-code`. When Claude tries to finish, the Stop hook checks everything changed since the session started and sends Claude back to fix deleted or skipped tests and removed assertions. Stops blocking after 3 attempts, only blocks on FAIL, and fails open on any error.
- `verify` command: compares the working tree (committed, staged, unstaged and untracked changes) against a git ref. Options `--base <ref>` (default `HEAD`) and `--json`. Exit codes: `0` PASS/SUSPICIOUS, `1` FAIL, `2` git error.
- Test extraction with tree-sitter for JavaScript, TypeScript, TSX and Python (Jest/Vitest/Mocha-style and pytest/unittest).
- **POD001 test-deleted**: tests or whole test files removed.
- **POD002 test-skipped**: `.skip`, `xit`, `todo`, pytest/unittest skip markers, `pytest.skip()`, and newly added `.only`.
- **POD003 assertion-removed**: fewer assertions in a test than before.
- Refactor handling: renamed and moved tests are recognised; when a change adds at least as many assertions as it removes, POD001/POD003 findings are warnings instead of failures.
- Short, capped feedback for the agent with every finding.

[Unreleased]: https://github.com/wasaybuilds/proof-of-done/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/wasaybuilds/proof-of-done/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/wasaybuilds/proof-of-done/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/wasaybuilds/proof-of-done/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/wasaybuilds/proof-of-done/releases/tag/v0.1.0
