# assertEqual replaced by assertTrue

Reported (in Go, testify): the agent rewrote an assert.Equal as assert.True while claiming coverage. Reproduced here with Python unittest.

Source: https://github.com/anthropics/claude-code/issues/6193

Minimal reproduction of the reported pattern. The code is illustrative, not copied from the source.
