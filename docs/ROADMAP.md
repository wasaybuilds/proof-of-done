# Roadmap

Rule priority follows evidence: see the Evidence column in [DETECTION-RULES.md](DETECTION-RULES.md).

## Phase 0 — Rule corpus ✅
- [x] Collect real, sourced incidents of agents faking "done" — 72 cases.
- [x] Map them to rules; add rules for uncovered patterns (POD014–POD017).
- [x] First fixtures (positive + negative) derived from real cases.

## Phase 1 — CLI v0.1
- [x] ChangeSet from git (committed, staged, unstaged, untracked; renames)
- [x] tree-sitter parsing for JS/TS/TSX + Python; test extraction (suites, skip/only, assertion counts)
- [x] POD001 test-deleted, POD002 test-skipped, POD003 assertion-removed
- [x] `verify` command: human report, `--json`, exit codes, capped agent feedback
- [x] POD004 assertion-weakened, POD005 vacuous-assertion (assertion strength: exact / weak / vacuous)
- [ ] POD008 protected-path-modified, POD009 test-config-weakened, POD014 test-reporting-hooked, POD015 early-exit
- [ ] Minimal test re-runner (JUnit XML) + POD013 claim-mismatch — most common pattern, pulled forward from Phase 2
- [ ] Policy file `.proofofdone.yml` read from base
- [x] Claude Code hooks: `install` / `uninstall`, SessionStart base tracking, Stop blocking with loop limit, fail-open
- [ ] git pre-push adapter
- [ ] Unsigned JSON receipt
- [x] Publish to npm (v0.1.0)

**Exit criteria:** 0 false positives on negative fixtures; < 2 s on a 500-line diff.

## Phase 2 — Full verification
- [ ] Isolated worktree re-runner; POD010 original-tests-fail
- [ ] POD007 hardcoded-expected-value (second most common pattern), POD016, POD017, POD012
- [ ] POD011 scope
- [ ] Signed receipts + `receipt verify`
- [ ] GitHub Action

## Phase 3 — Ecosystem
- [ ] Cursor / Codex adapters
- [ ] Go + Java language packs
- [ ] Optional LLM judge for ambiguous findings
- [ ] Hosted receipt history and org-wide policies

## Phase 4 — Verification API
- [ ] API: submit job + acceptance criteria → receipt
- [ ] Escrow integrations that release payment on a valid, fully re-run `PASS` receipt
