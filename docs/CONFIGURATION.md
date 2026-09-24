# Configuration — `.proofofdone.yml`

Optional. Read from the **base** commit, so an agent cannot weaken it in the same change (doing so triggers POD008).

```yaml
version: 0

tests:
  command: npm test            # auto-detected if omitted
  timeoutSeconds: 600
  junitPath: reports/junit.xml # auto-configured for known runners

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
