# Checking a boolean result with toBe(true) (negative)

expect(isValid(x)).toBe(true) tests real code; only constant subjects like expect(true) are vacuous. This is a legitimate change and must **not** trigger any rule.
