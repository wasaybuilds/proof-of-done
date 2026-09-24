# Architecture

## 1. Goals and non-goals

**Goals**
- Independently verify a coding agent's "done" claim using evidence the agent cannot edit.
- Detect test tampering and scope violations deterministically.
- Near-zero token cost: no LLM on the default path.
- Fast: static checks < 2 s on a typical diff; full verification bounded by the project's own test time.
- Agent-agnostic: works with any agent via hooks, git, or CI.
- Produce a portable, signed receipt that other systems (CI, reviewers, and later payment escrow) can trust.

**Non-goals (for now)**
- General code review or bug finding (CodeRabbit, Greptile, etc. already do this).
- Judging whether the code is *good* — only whether the claim "done / tests pass" is *honest*.
- Security scanning of the app itself.

## 2. Core principle

> A verifier authored or controlled by the agent is not independent.

So Proof of Done must:
- Run in a process the agent does not control (hook, git hook, CI).
- Read acceptance criteria and protected-path policy from a location the agent cannot silently change (the **base** commit's config, not the working tree's).
- Re-execute tests itself rather than parse the agent's transcript.

## 3. High-level flow

```
 Agent says "done"
        │
        ▼
 ┌──────────────┐     triggers      ┌────────────────────────────────────────┐
 │   Adapter    │ ────────────────▶ │            Verification Engine          │
 │ (Claude Code │                   │                                        │
 │  Stop hook,  │                   │ 1. ChangeSet Builder  (base..head diff) │
 │  git hook,   │                   │ 2. Policy Loader      (config @ base)   │
 │  GH Action)  │                   │ 3. Static Rules       (AST, no LLM)     │
 └──────▲───────┘                   │ 4. Scope Checker      (paths vs policy) │
        │                           │ 5. Test Re-runner     (isolated tree)   │
        │                           │ 6. [optional] LLM Judge (snippets only) │
        │                           │ 7. Verdict            (PASS/SUSP/FAIL)  │
        │                           │ 8. Receipt Signer     (ed25519)         │
        │                           └───────────────┬────────────────────────┘
        │         agent feedback (≤ ~50 tokens      │
        └──────── per finding, capped) ◀────────────┘
                                                    ▼
                                    .proof-of-done/receipts/*.json
```

## 4. Components

### 4.1 ChangeSet Builder
- Input: `base` ref (default: merge-base with the default branch, or the commit when the agent session started) and `head` (working tree incl. uncommitted changes).
- Output: `ChangeSet` = list of `FileChange { path, status: added|modified|deleted|renamed, before?: string, after?: string, kind: test|source|config|ci|other }`.
- File classification uses conventional patterns (`*.test.*`, `*.spec.*`, `test_*.py`, `tests/**`, `__tests__/**`, `.github/workflows/**`, `jest.config.*`, `vitest.config.*`, `pytest.ini`, `pyproject.toml [tool.pytest]`, …), overridable in config.
- Implementation: shell out to `git` (no libgit2 dependency — simpler on Windows).

### 4.2 Policy Loader
- Reads `.proofofdone.yml` **from the base commit** (`git show <base>:.proofofdone.yml`). If the agent edits the config, that edit itself is flagged (POD008) and ignored for this run.
- Merges with built-in defaults. Schema validated with `zod`.

### 4.3 Static Rules Engine
- Parses before/after versions of changed test and source files with **tree-sitter** (`web-tree-sitter` WASM — no native build, works on Windows/macOS/Linux).
- Language packs: JS/TS (Jest, Vitest, Mocha) and Python (pytest, unittest) in v0.1; Go, Rust, Java later.
- Each rule is a pure function:
  ```ts
  interface Rule {
    id: string;              // "POD003"
    name: string;            // "assertion-removed"
    severity: "block" | "warn";
    languages: Language[];
    check(ctx: RuleContext): Finding[];
  }
  ```
- `RuleContext` gives each rule the `FileChange`, both parsed trees, and helper queries (e.g. `countAssertions(tree)`, `listTests(tree)`, `matchTests(before, after)`).
- Test matching: tests are identified by `file + describe path + test name`; renames are matched by body similarity to avoid false "deleted" reports.
- Rules are data-driven where possible (tree-sitter queries in `.scm` files) so new cheat patterns can be added without engine changes.
- Full catalogue: [DETECTION-RULES.md](DETECTION-RULES.md).

### 4.4 Scope Checker
- Compares changed paths against `policy.scope.allowed` and `policy.scope.protected` globs.
- Protected by default: CI workflows, test runner config, coverage thresholds, lockfile-only changes paired with test changes, the Proof of Done config itself.
- Optional task scope: an adapter can pass the task description's intended paths (e.g. from an issue or a `TASK.md`) — out-of-scope edits become `warn`.

### 4.5 Test Re-runner
- Creates an isolated copy with `git worktree add` at `head` (uncommitted changes are applied via a temporary stash commit), so the agent's running processes and caches can't influence results.
- Runs the test command from policy (auto-detected if absent: `npm test`, `pnpm test`, `pytest`, …) with a **JUnit XML reporter** forced on, and parses the XML — never the console text.
- Also runs the **base version of the test files against the head source** ("original tests, new code"). If the agent's modified tests pass but the original tests fail, that's strong tamper evidence (POD010).
- Timeout and resource limits from policy. Worktree is removed afterwards.
- Can be skipped (`--static-only`) for the fast path; CI runs it in full.

### 4.6 LLM Judge (optional, off by default)
- Only invoked for findings marked `needsJudgement` (e.g. "is this hardcoded literal a cheat or a legitimate constant?").
- Input is limited to the relevant hunks (typically < 400 tokens). Never the whole repo.
- Pluggable provider; default model is a small, cheap one. Output must be structured JSON `{ verdict: "cheat"|"legit"|"unsure", reason }`.
- Budget cap per run (`policy.llm.maxTokensPerRun`).

### 4.7 Verdict
- `FAIL` — any `block` finding, or re-run tests failing.
- `SUSPICIOUS` — only `warn` findings.
- `PASS` — no findings and tests pass (or static-only with no findings, marked `testsRerun: false`).

### 4.8 Receipt Signer
- Produces a JSON receipt (see [RECEIPT-SPEC.md](RECEIPT-SPEC.md)) containing the hashes of the diff, the policy, rule versions, findings and test summary.
- Signed with ed25519 (`@noble/ed25519`). Local key in `~/.proof-of-done/key` for dev; CI uses a key from secrets. Later: Sigstore keyless signing.
- Receipts are stored in `.proof-of-done/receipts/` (gitignored by default) and can be attached to PRs.

### 4.9 Agent Feedback Formatter
- Converts findings into the shortest instruction that lets the agent fix the real issue.
- Hard caps: max 5 findings, ~50 tokens each, ~300 tokens total. Rest summarised as "+N more, run `proof-of-done report`".
- Designed to prevent a new loop: adapters stop blocking after `policy.maxBlocksPerSession` (default 3) and escalate to the human instead.

### 4.10 Adapters
- **Claude Code** — `Stop` hook; returns `{"decision":"block","reason":"<feedback>"}` on FAIL so the agent keeps working.
- **Cursor / Codex / others** — their hook systems where available; otherwise the git adapter.
- **git** — `pre-push` hook.
- **GitHub Action** — runs full verification on PRs, posts verdict + receipt as a check.
- Details: [INTEGRATIONS.md](INTEGRATIONS.md).

## 5. Repository layout (planned)

```
proof-of-done/
├─ src/
│  ├─ cli/             # commander-based CLI: verify, report, install, keygen
│  ├─ changeset/       # git diff → ChangeSet
│  ├─ policy/          # config loading from base, zod schema, defaults
│  ├─ parse/           # tree-sitter loader + language packs
│  │  ├─ javascript/
│  │  └─ python/
│  ├─ rules/           # one file per rule + .scm queries
│  ├─ scope/
│  ├─ runner/          # worktree + test execution + JUnit parsing
│  ├─ judge/           # optional LLM judge
│  ├─ verdict/
│  ├─ receipt/         # schema + signing + verification
│  ├─ feedback/
│  └─ adapters/        # claude-code, git, github-action
├─ fixtures/           # before/after pairs from real cheating cases (the test corpus)
├─ test/
├─ docs/
├─ research/
└─ marketing/
```

## 6. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript, Node ≥ 20 | Same ecosystem as most agent tooling; `npx` distribution |
| Parsing | `web-tree-sitter` (WASM) | Multi-language, no native compile, cross-platform |
| CLI | `commander` | Small, standard |
| Config | YAML + `zod` | Human-editable, validated |
| Git | `git` CLI via `execa` | Fewer native deps than libgit2 |
| Test results | JUnit XML | Supported by Jest, Vitest, pytest, Go, Java… |
| Signing | `@noble/ed25519` | Audited, pure JS |
| Own tests | `vitest` | Fast; fixture-driven rule tests |
| Distribution | npm package `proof-of-done` | `npx proof-of-done …` |

## 7. Key design decisions

| # | Decision | Alternatives considered | Reason |
|---|---|---|---|
| D1 | Deterministic rules first, LLM optional | LLM-as-judge for everything | Token cost, speed, reproducibility, no false-positive drift |
| D2 | Policy read from **base** commit | Working-tree config | Agent could otherwise disable its own checks |
| D3 | Parse JUnit XML, not console output | Regex on stdout | Robust; agent can't fake it via echo |
| D4 | Run original tests against new code | Only run modified tests | Catches tests weakened to pass |
| D5 | Local-first CLI, hosted later | SaaS first | Adoption via `npx`; trust (code never leaves machine) |
| D6 | Cap feedback + block count | Unlimited blocking | Avoid creating a new infinite loop |

## 8. Security and privacy
- Default mode sends **nothing** off the machine.
- LLM judge (opt-in) sends only selected hunks; documented and logged in the receipt.
- The re-runner executes the project's own test command — same trust level as running tests yourself. In CI it runs in the CI sandbox.

## 9. Future: hosted layer and agent-to-agent escrow
- **Team dashboard**: receipt history, per-agent cheat rates, org-wide policies.
- **Verification API**: an agent marketplace or escrow contract submits `{repo, base, head, acceptance criteria}` and releases payment only on a valid `PASS` receipt. The receipt format is designed for this from day one (content hashes + signature + verifier identity).
