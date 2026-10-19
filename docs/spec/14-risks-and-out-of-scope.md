# Assumptions, risks and revisit triggers

> **Dev-only scope (D-300 to D-303):** risks about parked runs, client uploads, client accounts and retention apply from go-live; see the go-live list.

> Originally taken from a Claude Doc (2026-10-05) that has since been retired. The repo is the source of truth; this file reflects the owner-approved decisions recorded in `DECISIONS.md`. Agents change files in `docs/spec/` only after the owner approves a proposal in `docs/proposals/` (see `AGENTS.md`).

The riskiest items are local workers going offline mid-stage, a hung or looping agent run, and agent-written copy missing the client's voice.

| Item | Type | Mitigation or trigger |
| --- | --- | --- |
| Worker machine goes offline mid-stage | Risk | Stages are resumable from stage_runs; runner interface allows moving to a VPS or workflow engine |
| Agent copy misses brand voice | Risk | Owner edits copy at prototype and round gates; capture tone inputs in intake |
| Prompt injection via client uploads or text | Risk | Treat as untrusted; scoped tokens; owner approval for destructive commands |
| Vercel free plan limits for commercial sites | Assumption | Paid plan from the first real client; verify the terms (unverified) |
| Token costs per project | Assumption | Measure on the pilot, then update the estimate |
| Lighthouse 80+ achievable on starter | Assumption | Tune the master starter first |
| Revisit orchestration | Trigger | 3+ projects in parallel, runs stalling for days, or moving workers off the owner's machine |
| Revisit scope | Trigger | Requests for e-commerce, auth, or database-backed sites |
| Revisit alerts | Trigger | Missed approvals even with the console badges and the owner emails (gate ready, ready to advance, pause request, run failed, client actions) |
| Credentials in the handover document | Risk (accepted) | The document may contain credentials, is shown on the client dashboard, sits in the database and in backups for up to 180 days, and is erased by the retention job; rotating shared keys after first login would reduce exposure |
| Owner login without multi-factor | Risk (accepted) | None planned, now or at go-live; a hard-gate Accept needs the project name typed (D-268) |
| No regular restore drill for backups | Risk (accepted) | One restore into a scratch database is proved in Phase 1 (D-294); later exports are unproven until restored |
| Branch protection deferred; CI starts in Phase 1 | Revisit | Until the workflow is merged and green, an agent's "tests pass" is its own report (D-287) |
| Install scripts for all packages are contained only by the run's container | Risk (accepted) | Each run is a container with limited egress and no Supabase credentials; the lockfile diff and a curated allowlist expose new packages (D-266, D-286) |
| A looping agent that keeps producing output | Risk (accepted) | The no-progress watchdog stops a silent hang, but a loop that keeps writing output is stopped only by the owner's Cancel; there is no cost warning, and the token progress bar is the only signal |
| A waiting run keeps its slot | Risk (accepted) | An unanswered pause request occupies one of the 2 project slots for up to 1 hour, then the run is parked |
| The client never uses the live site before go-live | Risk (accepted) | The client sees screenshots only; hover, menus, forms and animation are reviewed by the owner alone |
| Owner edits overwrite client answers with no history | Risk (accepted) | The client's original wording is lost; the approval log does not record answer edits |
| Silent clients stall the pipeline | Risk (accepted) | No reminder emails; the owner's overdue badge is the only signal |
| Pipeline email comes from a personal Gmail and waits while the worker is offline | Risk (accepted) | Client emails carry the owner's personal address; an offline laptop delays every email, including the owner's own alerts; Gmail has daily sending limits |
| Backups keep deleted client data for up to 180 days | Risk (accepted) | The privacy page says so; exports are deleted after 180 days |
| A failed form submission can be lost | Risk (accepted) | No archive or fallback copy; the visitor sees the phone number and plain contact links |
| Form delivery is not monitored after handover | Risk (accepted) | A broken mailbox login goes unnoticed until someone tests; the handover guide explains how |
| Worker secrets in a plain `.env` file | Risk (accepted) | Relies on full-disk encryption; a password manager CLI or the OS keychain is the upgrade |
| No hard spend limit in the Anthropic console | Risk (accepted) | A wall-clock cap, a turn limit and spend alerts apply; there is no token-based kill and no hard cap (D-276) |
| Large original images committed as uploaded | Risk (accepted) | Images over 5 MB are rejected, but 5 MB originals still make the repo and builds heavier |
| Pilot skips DNS and the custom domain | Risk (accepted) | Those steps are first exercised on a real client |
| Mini-rounds after go-live skip most of QC | Risk (accepted) | Lighthouse runs on the pages a request touches; accessibility tooling beyond Lighthouse is not added (D-285) |
| Microsoft 365 basic SMTP sign-in is being retired | Risk | The starter supports OAuth 2.0 for Microsoft 365; generic SMTP and app passwords cover other mailboxes |
| Supabase MCP server | Risk | It points at the local stack and is read-only; agents use it for reads and documentation only; any write needs the owner's approval (D-274) |
| No laptop-lost runbook | Risk (accepted) | A lost laptop exposes the worker secrets until they are rotated by hand; relies on disk encryption |
| One copy of the backup encryption key | Risk (accepted) | Losing the key makes every backup unreadable |
| Handover credentials stored in the database | Risk (accepted) | Kept for the dev-only period and a go-live item (D-273) |
| No automated check when a prompt or model changes before the Planner exists | Risk (accepted) | Model IDs are pinned and `prompt_hash` is logged (D-283) |
| Unmarked factual claims in agent copy | Risk (accepted) | The claim scan and the LLM verifier catch them only probabilistically (D-284) |
| Development is dev-only until go-live | Revisit | Hosting, client email, plans and the other deferred items are listed in `docs/plan/go-live-readiness.md` (D-296) |
| Supabase free plan may pause an inactive project | Assumption | Check the current rule; add a weekly keep-alive request if it applies |

**Out of scope for v1:** multi-tenant use by other developers, e-commerce, user-facing databases, automated billing and invoicing, CMS-based editing, chat notifications, owner emails beyond gate-ready, ready-to-advance, pause-request, run-failed and client-action events, multi-language sites, quotes and price estimates, and changes after a project is closed.
