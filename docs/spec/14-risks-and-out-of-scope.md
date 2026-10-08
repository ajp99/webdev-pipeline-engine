# Assumptions, risks and revisit triggers

> Originally a snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05). The repo is the source of truth; this file includes the owner-approved decisions D-038 to D-069 recorded in `DECISIONS.md`. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

The riskiest items are local workers going offline mid-stage, client unfamiliarity with the GitHub editor, and agent-written copy missing the client's voice.

| Item | Type | Mitigation or trigger |
| --- | --- | --- |
| Worker machine goes offline mid-stage | Risk | Stages are resumable from stage_runs; runner interface allows moving to a VPS or workflow engine |
| Client struggles with GitHub web editor | Risk | Screenshot-based guide per project; offer a maintenance option later |
| Agent copy misses brand voice | Risk | Owner edits copy at prototype and round gates; capture tone inputs in intake |
| Prompt injection via client uploads or text | Risk | Treat as untrusted; scoped tokens; owner approval for destructive commands |
| Vercel free plan limits for commercial sites | Assumption | Verify; budget a paid plan |
| Token costs per project | Assumption | Measure on the pilot, then update the estimate |
| Lighthouse 80+ achievable on starter | Assumption | Tune the master starter first |
| Revisit orchestration | Trigger | 3+ projects in parallel, runs stalling for days, or moving workers off the owner's machine |
| Revisit scope | Trigger | Requests for e-commerce, auth, or database-backed sites |
| Revisit alerts | Trigger | Missed approvals even with the console badges and the owner emails (gate ready, pause request, run failed) |
| Credentials shared over WhatsApp or email | Risk (accepted) | The handover document may contain credentials; rotating shared keys after first login would reduce exposure |
| Owner login without multi-factor | Risk (accepted) | Add multi-factor when the owner decides to |
| No restore drill for backups | Risk (accepted) | Exports are unproven until restored once |
| CI and branch protection deferred | Revisit | Until CI exists, an agent's "tests pass" is its own report |
| Workers isolated by directory only | Risk (accepted) | Container isolation is the next step if the risk grows |
| No time limit on runs | Risk (accepted) | A runaway agent loop keeps a fresh heartbeat, and there is no cost warning; the token progress bar is the only signal |
| A waiting run keeps its slot | Risk (accepted) | An unanswered pause request can occupy one of the 2 project slots indefinitely |
| The client never uses the live site before go-live | Risk (accepted) | The client sees screenshots only; hover, menus, forms and animation are reviewed by the owner alone |
| Owner edits overwrite client answers with no history | Risk (accepted) | The client's original wording is lost; the approval log does not record answer edits |
| Silent clients stall the pipeline | Risk (accepted) | No reminder emails; the owner's overdue badge is the only signal |
| A failed form submission can be lost | Risk (accepted) | No archive or fallback copy; the visitor sees the phone number and plain contact links |
| Form delivery is not monitored after handover | Risk (accepted) | A broken mailbox login goes unnoticed until someone tests; the handover guide explains how |
| Worker secrets in a plain `.env` file | Risk (accepted) | Relies on full-disk encryption; a password manager CLI or the OS keychain is the upgrade |
| No hard spend limit in the Anthropic console | Risk (accepted) | The token progress bar is the only signal on spend |
| Large original images committed as uploaded | Risk (accepted) | Images over 5 MB are rejected, but 5 MB originals still make the repo and builds heavier |
| Pilot skips DNS and the custom domain | Risk (accepted) | Those steps are first exercised on a real client |
| Mini-rounds after go-live skip QC | Risk (accepted) | A regression Lighthouse would catch can reach production |
| Microsoft 365 basic SMTP sign-in is being retired | Risk | The starter supports OAuth 2.0 for Microsoft 365; generic SMTP and app passwords cover other mailboxes |

**Out of scope for v1:** multi-tenant use by other developers, e-commerce, user-facing databases, automated billing and invoicing, CMS-based editing, chat notifications, owner emails beyond gate-ready, pause-request and run-failed events, multi-language sites, quotes and price estimates, and changes after a project is closed.
