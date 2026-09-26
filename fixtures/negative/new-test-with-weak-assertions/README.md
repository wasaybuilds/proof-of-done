# New test that only uses weak assertions (negative)

Adding a smoke test with toBeDefined()/toBeTruthy() is fine; weakening is only flagged when an existing specific check is replaced. This is a legitimate change and must **not** trigger any rule.
