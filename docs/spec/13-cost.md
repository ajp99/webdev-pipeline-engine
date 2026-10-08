# Cost estimate

> Originally a snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05). The repo is the source of truth; this file reflects the owner-approved decisions recorded in `DECISIONS.md`. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

Expect roughly $15-35 of Claude tokens per marketing-site project, and about $50-130 a month in total for two projects. Token usage is a planning estimate, not measured; replace it with real numbers after the pilot project.

| Stage | Est. token cost per project |
| --- | --- |
| Intake and follow-ups | about $0.30 |
| Requirements, plan, skill selection | about $0.50 |
| Single-page prototype | about $2 |
| Build rounds (about 2-4) | about $10-15 |
| QC runs and report | about $2-3 |
| Docs and handover pack | about $1-2 |

| Monthly item | Estimate |
| --- | --- |
| Claude API, Sonnet 5.5 at $2 / $10 per million input/output tokens, cache reads $0.20 | per project above; Opus 5.5 ($4 / $20) for build rounds roughly doubles it |
| Supabase | $0 on free tier until the pilot, about $25 on Pro afterwards |
| Vercel for client sites | about $20 on Pro (needed for commercial use; verify) |
| Worker host | $0 (owner's machine) |
| Lighthouse CI, Playwright, Gmail SMTP for the pipeline's emails | $0 at low volume |
| 2 projects per month, all-in | about $50-130 |
| 5 projects per month, all-in | about $95-230 |

Cost levers: use Haiku 4.5 for intake and summaries, use the Batch API (half price) for non-urgent steps like docs, and rely on prompt caching for repeated context. Prices are approximate as of October 2026; confirm against the [Claude pricing page](https://platform.claude.com/docs/en/about-claude/pricing). Inngest or Trigger.dev would add $0 on a free tier, or about $50-99 a month if the free tier is outgrown; their listed prices vary by source.

The eval harness adds Opus 5.5 judge calls whenever prompts or models change; measure them in phase 3. Pipeline emails go out through the owner's Gmail over SMTP; check Google's current sending limits before relying on them.
The console shows token use only (D-138, D-140): a progress bar against the plan's token budget, with no dollar amounts and no warnings. The dollar figures above are planning estimates; compare real runs with them by converting by hand.
