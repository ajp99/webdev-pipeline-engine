# Summary and locked decisions

> Originally a snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05). The repo is the source of truth; this file includes the owner-approved decisions D-038 to D-069 recorded in `DECISIONS.md`. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

CreatePipeline Engine is a single-owner internal system that takes a marketing-site client from intake to handover, with agents doing the work and the owner approving every step. Orchestration is Supabase-backed state with local workers, behind a swappable runner.

| Area | Locked decision |
| --- | --- |
| Product | Internal tool for one owner (freelance/agency pipeline); not multi-tenant |
| Project type | Marketing sites and landing pages |
| Autonomy | Human-in-the-loop: owner approves every stage; three gate types (soft, hard, client), no auto-advance, overdue gates only get a badge |
| Orchestration | Agent SDK workers plus Supabase state; the runner polls a durable queue (`stage_runs`) every 15 to 30 seconds; stage runner interface so Inngest or Trigger.dev can replace it later |
| Worker host | Owner's own machine (must be online while a stage runs) |
| Intake | Hybrid: industry templates plus agent follow-ups on vague answers |
| Industry templates | Agent generates, owner edits and approves, then saved to library |
| Client assets | Optional uploads (logo, favicon, assets, content); agent structures and generates copy |
| Client login | Email + password accounts |
| Client dashboard | Intake, progress tracker, prototype preview and approval, comments on the prototype only |
| Client comments | Prototype comments only; they reach owner first as raw text, and owner decides what goes to agents |
| Prototype | Single-page clickable preview of the main page |
| Build rounds | Agent proposes round count and scope from pages and features; owner approves (about 2 for simple, 4 for larger) |
| Skills | Reusable Git library of SKILL.md files; project skills move project-local, candidate, library, deprecated, with owner review at match confirmation and at the generalization diff |
| Site architecture | Static-first Next.js, MDX/JSON content, blog, contact form emailed via Resend, no database |
| QC bar | Lighthouse 80+, basic SEO checks, simple generic checklist passing |
| Alerts | Owner: dashboard only (approval queue with badge counts and overdue badges). Clients: emails via Resend for four events (intake follow-ups ready, PRD ready, prototype ready, ask-client question waiting) |
| Hosting | Owner hosts on Vercel first, ownership transferred at handover; Vercel deploys through its Git integration (rounds on `staging`, production from `main`) |
| Post-handover edits | Client edits MDX/JSON via GitHub web editor using a short guide |
| Credentials | Ownership transfers plus a handover document shared manually by WhatsApp or email; it may contain credentials (accepted risk) |
| Domain and DNS | Handled manually by owner or client, per client |
| Final acceptance | No client approval before go-live; the client sees the final site once it is live, and changes until handover is complete go through change requests |
| Project close | Ownership transferred, scoped tokens revoked, read-only archive; uploads and intake data deleted 90 days after close (adjustable per project); client accounts stay active until the owner disables them |
| Legal pages | Every site gets a privacy policy and cookie notice drafted by the agent for owner review |
| Copy claims | Agents may draft plausible copy; every factual claim is highlighted for owner review |
| Lifecycle | Projects can be paused; a cancelled project is closed and archived; changes after close are handled outside the pipeline |
| Round review | Each build round is a pull request into the client repo's `staging` branch; console Accept merges it, Feedback comments on it, Reject closes it; a merge by the owner's GitHub account also counts as Accept (webhook) |
| Worker access | GitHub App with short-lived tokens limited to one client repo per run; workers hold no Vercel token; an owner-run provisioning script sets up each project |
| Operations | Encrypted database exports on a schedule and before each close; GitHub secret scanning on, CI and branch protection later; automated agent evals (Planner first, Opus 5.5 judge); pilot on the owner's own site; read-only MCP server at the end of phase 5 (see 15-operations.md) |
