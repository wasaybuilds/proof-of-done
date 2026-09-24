# Roadmap

## Phase 0 — Evidence (week 1)
Goal: prove the problem is real and common before writing the engine.
- [ ] Collect 50–100 **real, sourced** cases of agents faking "done" (GitHub issues/PRs, dev.to, Reddit, X, HN, papers).
- [ ] Log each in `research/cases.csv` (source URL, agent, language, cheat type, rule ID).
- [ ] Turn the 5–10 clearest cases into `fixtures/` before/after pairs.
- [ ] Publish case study #1 on LinkedIn (see `marketing/linkedin/`).

**Exit criteria:** ≥ 50 cases; cheat types map to ≤ 10 rules covering ≥ 80% of cases.

## Phase 1 — CLI v0.1, static-only (weeks 2–3)
- [ ] ChangeSet builder, policy loader, tree-sitter JS/TS + Python
- [ ] Rules POD001–006, POD008, POD009
- [ ] Human report + agent feedback formatter
- [ ] Claude Code Stop hook + git pre-push adapter
- [ ] Unsigned JSON receipt
- [ ] Publish to npm, launch post (HN / X / r/ClaudeAI / LinkedIn)

**Exit criteria:** < 5% false positives on negative fixtures; < 2 s on a 500-line diff.

## Phase 2 — Full verification (weeks 4–6)
- [ ] Isolated worktree test re-runner, JUnit parsing
- [ ] POD010 original-tests-fail, POD013 claim-mismatch, POD011 scope, POD007 hardcoded values
- [ ] Signed receipts + `receipt verify`
- [ ] GitHub Action

**Exit criteria:** 300+ weekly active installs, 20+ user-submitted "caught my agent" reports.

## Phase 3 — Teams (months 2–3)
- [ ] Cursor / Codex adapters, Go + Java language packs
- [ ] Optional LLM judge for ambiguous findings
- [ ] Hosted dashboard (paid): receipt history, cheat rate per agent/model, org policies

## Phase 4 — Verification API for agent-to-agent work
- [ ] API: submit job + acceptance criteria → receipt
- [ ] Escrow integrations (x402 / stablecoin escrow) that release payment on a valid PASS receipt

## Business model (draft)
- Open-source CLI (MIT) — free forever, drives adoption.
- Team tier — hosted dashboard, policy management, retention.
- Verification API — per-verification pricing for marketplaces and escrow.
