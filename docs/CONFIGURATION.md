# Configuration — `.proofofdone.yml`

Optional. Read from the **base** commit, so an agent cannot weaken it in the same change (doing so triggers POD008). In Claude Code the base is the state the session started from.

## Available now: `tests`

Lets Proof of Done check an agent's claim that the tests pass (POD013): when the agent's final message says so, it runs this command and reads the JUnit XML report.

```yaml
version: 0
tests:
  command: npx vitest run --reporter=junit --outputFile={junit}
  timeoutSeconds: 300   # default 300, max 540
```

- `{junit}` is replaced with a fresh path outside the project, where the command must write its JUnit XML report. If your runner can't take a path, set `junitPath` (relative to the repository root) instead; any file there is deleted before the run.
- Only the report counts. Console output and the exit code are ignored.
- The command runs in the repository root with your shell, and `PROOF_OF_DONE_JUNIT` is set to the report path. If it times out, it is stopped along with everything it started.

| Runner | `command` |
|---|---|
| Vitest | `npx vitest run --reporter=junit --outputFile={junit}` |
| pytest | `python -m pytest -q --junitxml={junit}` |
| Jest | `npx jest --ci --reporters=default --reporters=jest-junit` with `junitPath: junit.xml` (needs the `jest-junit` package) |
| Mocha | `npx mocha --reporter mocha-junit-reporter --reporter-options mochaFile={junit}` (needs `mocha-junit-reporter`) |
| Go | `gotestsum --junitfile {junit}` |

## Planned

The rest of the file is not read yet:

```yaml
version: 0

classify:
  tests: ["**/*.test.*", "**/*.spec.*", "tests/**", "**/test_*.py"]
  extra_protected: ["migrations/**"]

scope:
  protected:
    - ".github/workflows/**"
    - "jest.config.*"
    - "vitest.config.*"
    - "pytest.ini"
  allowed: []                  # empty = everything not protected

rules:
  POD004: warn                 # override severity
  POD007: off

agent:
  maxBlocksPerSession: 3
  maxFeedbackTokens: 300

llm:
  enabled: false
  provider: anthropic
  model: claude-haiku-4-5-20251001
  maxTokensPerRun: 2000
```
