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
| Revisit alerts | Trigger | Missed approvals because dashboard-only checks are too slow |
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

**Out of scope for v1:** multi-tenant use by other developers, e-commerce, user-facing databases, automated billing and invoicing, CMS-based editing, chat notifications, owner email notifications, multi-language sites, quotes and price estimates, and changes after a project is closed.
