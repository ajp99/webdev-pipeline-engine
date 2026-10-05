# Assumptions, risks and revisit triggers

> Snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (as of 2026-10-05). From this commit the repo is the source of truth. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

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

**Out of scope for v1:** multi-tenant use by other developers, e-commerce, user-facing databases, automated billing and invoicing, CMS-based editing, email or chat notifications, multi-language sites, quotes and price estimates, and changes after a project is closed.
