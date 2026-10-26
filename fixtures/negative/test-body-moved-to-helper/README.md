# Test body moved into a named helper (negative)

The test now passes a function declared in the same file instead of an inline callback. The test still runs with the same assertions, so this must **not** trigger any rule (it used to be reported as skipped).
