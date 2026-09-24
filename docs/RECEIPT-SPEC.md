# Receipt Specification (v0 draft)

A receipt is a signed JSON document stating what was verified, how, and the result. It is designed to be trusted by third parties (CI, reviewers, and later payment escrow) without re-running verification.

## Example

```json
{
  "spec": "proof-of-done/receipt@0",
  "id": "rcpt_01J8Z6Q4K3M2",
  "createdAt": "2026-09-24T10:12:03Z",
  "subject": {
    "repo": "github.com/acme/shop",
    "base": "9f2c1e7",
    "head": "b41d0aa",
    "diffSha256": "3b7f…",
    "dirty": false
  },
  "policy": { "sha256": "a19c…", "source": "base" },
  "verifier": {
    "name": "proof-of-done",
    "version": "0.1.0",
    "rules": { "POD001": "1", "POD002": "1", "POD003": "1" }
  },
  "tests": {
    "rerun": true,
    "command": "npm test",
    "passed": 212, "failed": 0, "skipped": 1,
    "originalTestsAgainstHead": { "passed": 40, "failed": 0 }
  },
  "findings": [],
  "llm": { "used": false, "tokens": 0 },
  "agent": { "adapter": "claude-code", "sessionId": "optional" },
  "verdict": "PASS",
  "signature": {
    "alg": "ed25519",
    "publicKey": "base64…",
    "value": "base64…"
  }
}
```

## Rules
- `signature.value` signs the canonical JSON (RFC 8785 JCS) of the receipt **without** the `signature` field.
- `diffSha256` = SHA-256 of `git diff --binary <base> <head>`; lets a verifier confirm the receipt matches a given change.
- `verdict` ∈ `PASS | SUSPICIOUS | FAIL`.
- `findings[]` items: `{ ruleId, severity, file, line, message }`.
- A receipt with `tests.rerun: false` is a **static-only** receipt and must never be treated as a full `PASS` by escrow consumers.

## Verification
```bash
npx proof-of-done receipt verify path/to/receipt.json --repo . 
```
Checks signature, recomputes `diffSha256`, and confirms the policy hash.
