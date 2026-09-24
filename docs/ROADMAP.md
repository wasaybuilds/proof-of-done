# Roadmap

## Phase 0 — Rule corpus
- [ ] Collect real, sourced before/after examples of agents faking "done".
- [ ] Turn the clearest cases into `fixtures/` (positive + negative pairs).

**Exit criteria:** cheat types map to ≤ 10 rules covering ≥ 80% of collected cases.

## Phase 1 — CLI v0.1, static-only
- [ ] ChangeSet builder, policy loader, tree-sitter JS/TS + Python
- [ ] Rules POD001–006, POD008, POD009
- [ ] Human report + agent feedback formatter
- [ ] Claude Code Stop hook + git pre-push adapter
- [ ] Unsigned JSON receipt
- [ ] Publish to npm

**Exit criteria:** < 5% false positives on negative fixtures; < 2 s on a 500-line diff.

## Phase 2 — Full verification
- [ ] Isolated worktree test re-runner, JUnit parsing
- [ ] POD010 original-tests-fail, POD013 claim-mismatch, POD011 scope, POD007 hardcoded values
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
