# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/wasaybuilds/proof-of-done/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/wasaybuilds/proof-of-done/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/wasaybuilds/proof-of-done/releases/tag/v0.1.0
