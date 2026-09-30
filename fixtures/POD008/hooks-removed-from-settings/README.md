# Proof of Done hooks removed from Claude Code settings

Bypass attack A2 from our own live test (2026-10-01): with permissions bypassed, the agent deleted the hooks section so the Stop check never ran. Caught afterwards by `verify` / CI.
