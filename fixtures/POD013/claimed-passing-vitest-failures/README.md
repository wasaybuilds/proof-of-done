# Claimed all tests pass; 5 of 28 fail when re-run

Reported: the agent claimed comprehensive, passing test coverage for new features, but 5 of the 28 committed Vitest tests were failing because they had never been run before the commit.

Source: https://github.com/anthropics/claude-code/issues/68154

Minimal reproduction of the reported pattern: `message.md` is the agent's final message, `junit.xml` the report of re-running the tests. The code is illustrative, not copied from the source.
