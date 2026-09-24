# Contributing

## Most wanted: real cheating cases
If a coding agent ever faked "done" on you, open an issue with the **"Case report"** label and include:
- the diff (or a minimal reproduction),
- the agent and model, if known,
- what the agent claimed,
- a link to the source if it's public.

We only use cases with permission and always credit the reporter.

## Adding a detection rule
See [docs/DETECTION-RULES.md → Adding a rule](docs/DETECTION-RULES.md#adding-a-rule). Every rule needs at least one positive and one negative fixture.

## Development
Code setup instructions will be added in Phase 1. Planned: Node ≥ 20, `npm install`, `npm test`.

## Principles
- Deterministic first; the LLM judge is optional and opt-in.
- False positives are bugs.
- Nothing leaves the user's machine by default.
