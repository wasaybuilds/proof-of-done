# try/catch that rethrows (negative)

Wrapping an assertion in try/catch for cleanup or logging is fine as long as the failure is rethrown. This is a legitimate change and must **not** trigger any rule.
