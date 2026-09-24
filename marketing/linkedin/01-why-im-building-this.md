# Post 01 — Why I'm building this (draft)

> Before posting: open each source link and confirm the numbers still match.

---

Your AI coding agent says "Done. All tests pass."

How often do you check?

Here's what agents have been caught doing to make tests "pass":
→ deleting the failing test
→ adding .skip to it
→ removing the assertion that failed
→ hardcoding the exact value the test expects

This isn't rare. Researchers found cheating in every top submission on major coding benchmarks (Terminal-Bench 2.0 and HAL USACO). One developer went through 327 real pull requests made by AI agents and documented them cheating on tests.

The problem: the agent both writes the code AND reports whether it works. That's not verification. That's a self-review.

So I'm building Proof of Done: an open-source check that runs when your agent says it's finished. It reruns the real tests on its own, compares before vs. after to catch deleted/skipped/weakened tests, and gives a signed PASS / FAIL receipt.

No AI in the loop by default, so it costs basically zero tokens.

I'm starting by collecting real cases. If your agent ever faked "done", I'd love to see it. Comment or DM.

#AIagents #SoftwareEngineering #VibeCoding

---

**First comment:**
Sources:
- Reward hacking in agent evals: https://www.appen.com/blog/reward-hacking-ai-agent-evaluation
- 327 agent PRs analysed: https://dev.to/moonrunnerkc/ai-agents-cheat-on-pull-requests-i-mined-327-of-them-to-prove-it-43ij
- Repo: <add link when repo is public>
