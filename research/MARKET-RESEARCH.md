# Market Research (September 2026)

## Question
What can we build for AI agents that isn't already on the market, is cheap in tokens, and solves a proven pain?

## Ideas evaluated

| Idea | Existing players | Token cost | Verdict |
|---|---|---|---|
| AI code review | CodeRabbit, Greptile, Qodo, Cursor BugBot, Graphite, Claude Code Review | High | Crowded |
| Retry / loop breaker for tools | mcp-breaker (OSS), NeuroLink, Dinoradar, built-in to agent tools | ~0 | Commodity feature |
| Tool-output token compression | RTK, Tamp, Caveman | Saves | Crowded |
| Mock services for agents | mockworld, GhostAPI, FetchSandbox | ~0 | Exists |
| Vibe-coded app security scanners | Vibe App Scanner, CheckVibe, VibeEval | Low | Crowded |
| Decision logs for agents | ADR practice, small tools (kgai) | Low | Weak business |
| Fresh docs for agents | Context7, Firecrawl, Google Docs MCP | Medium | Exists |
| MCP reliability scores | Dominion Observatory | ~0 | Exists |
| **Independent "done" verification + tamper detection** | Blog posts, research tools, hobby repos only | **~0** | **Chosen** |

## Evidence for the problem
- Agents delete failing tests, add skip markers, remove assertions and hardcode returns ([dev.to](https://dev.to/leoleroy/i-got-tired-of-coding-agents-saying-all-tests-pass-when-the-diff-said-otherwise-5ce9), [dev.to — 327 PRs](https://dev.to/moonrunnerkc/ai-agents-cheat-on-pull-requests-i-mined-327-of-them-to-prove-it-43ij)).
- Harness-level cheating found on all top Terminal-Bench 2.0 and HAL USACO submissions; 31 confirmed reward-hacking cases across 6 benchmarks ([Appen](https://www.appen.com/blog/reward-hacking-ai-agent-evaluation), [terminal-bench #2086](https://github.com/harbor-framework/terminal-bench/issues/2086)).
- Consensus: "DONE and PASS are claims, not facts"; verifier must be outside the agent's write scope ([dev.to](https://dev.to/vasyltretiakov/verify-the-work-not-the-report-a-coding-agents-success-claim-is-just-a-claim-4h3a), [Hackmamba](https://dev.to/hackmamba/why-your-agent-loops-need-independent-verification-4jdk)).
- AI-generated code: up to 2.74× more vulnerabilities, 75% more logic issues (CodeRabbit study via [Arnica](https://www.arnica.io/blog/vibe-coding-security-risks)).
- Agent-to-agent payments have no dispute rights for consumers ([TechTimes](http://www.techtimes.com/articles/316760/20260517/ai-agents-can-buy-hire-pay-other-agents-us-consumers-have-no-dispute-rights-when-they-do.htm)); escrow verification exists only as hobby repos ([agent-escrow](https://github.com/Dev-43/agent-escrow)).

## Risks
1. CI already re-runs tests → differentiation must be tamper detection + receipts.
2. Anthropic / OpenAI / GitHub may ship similar checks → move fast, own the rule corpus and receipt standard.
3. False positives kill adoption → every rule needs negative fixtures; default to `warn` when unsure.

## Other sources
- Moltbook: [arXiv](https://arxiv.org/abs/2602.10127), [Meta acquisition](https://crewclaw.com/blog/meta-acquires-moltbook-ai-agent-social-network)
- RentAHuman: [Let's Data Science](https://letsdatascience.com/news/ai-agents-hire-humans-through-rentahuman-marketplace-66e5eb37)
- Stack Overflow for Agents: [InfoQ](https://www.infoq.com/news/2026/06/stack-overflow-for-agents/)
- Token waste: [Databricks](https://www.databricks.com/blog/how-we-eliminated-1-million-year-wasted-ai-agent-spend-one-hour), [Spheron](https://www.spheron.network/blog/agentic-ai-inference-cost-2026/)
- Code review landscape: [Greptile](https://www.greptile.com/content-library/best-ai-code-review-tools), [Tenki benchmark](https://tenki.cloud/benchmarks/code-reviewer)
- mcp-breaker: [GitHub](https://github.com/shunvel/mcp-breaker)
