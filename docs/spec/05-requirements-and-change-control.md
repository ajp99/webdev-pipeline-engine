# Requirements lock and change control

> Originally a snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05). The repo is the source of truth; this file reflects the owner-approved decisions recorded in `DECISIONS.md`. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

After intake, the agent produces one versioned requirements document (PRD) that the owner edits and the client signs off. Once locked, scope changes only through change requests.

**PRD contents:**

- Business summary, goals, target audience
- Site map and page list with purpose per page, always including a privacy policy and cookie notice
- Features: blog, contact form, any embeds, with priority (Must / Should / Could / Won't), and the spam protection for the contact form chosen per project
- Content inventory: what the client supplied, what the agent will draft
- Brand inputs: logo, colors, tone, references
- Non-functional targets: Lighthouse 80+, basic SEO, responsive, accessibility basics

The PRD is a fixed list of structured sections, each written in markdown. The owner edits it in markdown text areas with a live preview and a side-by-side version diff. Alongside it the agent produces an internal, owner-only artifact with the gap and conflict list and their resolutions, which clients never see. The round plan is not part of the PRD: the Planner sets it after the PRD is locked. Agents read the owner's private notes while drafting but never quote them.

**Lock flow:** the agent drafts the PRD and the owner edits it as part of the stage. The client reviews the latest version on the dashboard together with an agent-written summary of what changed since they last looked, and can **Sign off** (one client gate; the signed version is frozen as v1.0) or **Request changes** with a note that comes to the owner, not to agents. The owner edits, a new version is sent, and the client is emailed again.

**Change requests:** any post-lock change creates a change-request record: description, affected pages and features, agent's impact note, and owner decision (accept into current round, defer to a later round, or decline). Accepted changes bump the PRD version. Change requests apply from go-live until the owner marks the handover complete; after close, changes are handled outside the pipeline. Clients can also submit change requests in the dashboard from go-live until the handover is complete. Client comments never change scope directly; the owner decides what becomes a change request.
