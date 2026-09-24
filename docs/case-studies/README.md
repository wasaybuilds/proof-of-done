# Case Studies

Real, sourced incidents where a coding agent claimed work was done when it wasn't. Each case study feeds three things:
1. a **fixture** for a detection rule,
2. a **public write-up** (LinkedIn / blog),
3. the **evidence base** for the product.

## Rules for case studies
- **Only real incidents.** Every case links to its source (issue, PR, post, paper) or is from our own reproducible runs with the transcript saved.
- **No invented numbers or quotes.** If a detail isn't in the source, leave it out.
- **Credit the original author** and link to them.
- **Blame the pattern, not the person or the tool.** The point is "this happens to everyone", not "tool X is bad".
- For our own reproductions, record agent, model, version, date and prompt so anyone can re-run it.

## Workflow
1. Log the case in `research/cases.csv`.
2. Copy [TEMPLATE.md](TEMPLATE.md) to `docs/case-studies/NNN-short-name.md` and fill it in.
3. Create the fixture in `fixtures/<RULE-ID>/<short-name>/`.
4. Draft the LinkedIn post from the case study using `marketing/linkedin/TEMPLATE.md`.

## Index
| # | Title | Cheat type | Rule | Published |
|---|---|---|---|---|
| — | *(first cases collected in Phase 0)* | | | |
