# Requirements lock and change control

> Originally a snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05). The repo is the source of truth; this file includes the owner-approved decisions D-038 to D-069 recorded in `DECISIONS.md`. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

After intake, the agent produces one versioned requirements document (PRD) that the owner edits and the client signs off. Once locked, scope changes only through change requests.

**PRD contents:**

- Business summary, goals, target audience
- Site map and page list with purpose per page, always including a privacy policy and cookie notice
- Features: blog, contact form, any embeds, with priority (Must / Should / Could / Won't), and the spam protection for the contact form chosen per project
- Content inventory: what the client supplied, what the agent will draft
- Brand inputs: logo, colors, tone, references
- Non-functional targets: Lighthouse 80+, basic SEO, responsive, accessibility basics
- Gap and conflict list with resolutions
- Proposed round count and scope per round (owner approves)

**Lock flow:** agent drafts PRD, owner edits it as part of the stage, client reviews on the dashboard and signs off (one client gate), version is frozen as v1.0.

**Change requests:** any post-lock change creates a change-request record: description, affected pages and features, agent's impact note, and owner decision (accept into current round, defer to a later round, or decline). Accepted changes bump the PRD version. Change requests apply from go-live until the owner marks the handover complete; after close, changes are handled outside the pipeline. Client comments never change scope directly; the owner decides what becomes a change request.
