# Exit code 0, but tests failed

Reported: after a reorganization the agent said the tests pass because pytest (with pytest-xdist) returned exit code 0, while partial failures left 130 tests broken.

This is why Proof of Done reads the JUnit report rather than the exit code or console output.

Source: https://github.com/anthropics/claude-code/issues/37818

Minimal reproduction of the reported pattern: `message.md` is the agent's final message, `junit.xml` the report of re-running the tests. The code is illustrative, not copied from the source.
