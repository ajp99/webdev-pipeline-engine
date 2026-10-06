# Intake system

> Originally a snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05). The repo is the source of truth; this file includes the owner-approved decisions D-038 to D-069 recorded in `DECISIONS.md`. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

Intake is a multi-step, multi-round form: an industry template sets the baseline questions, and an agent adds follow-ups only where answers are vague or contradictory.

1. Owner creates the project, picks an industry (or asks the agent to generate a new template), and invites the client with an email + password account.
2. Round 1: the client completes the template sections: business, audience, goals, pages, tone, competitors, brand, required features.
3. Optional uploads: logo, favicon, imagery, existing copy, links. Every field is optional; missing items are flagged, not blocking.
4. The intake agent reviews answers after each section and posts at most a few targeted follow-ups (vague goals, undefined terms, conflicting requirements).
5. Round 2 and later: client answers follow-ups. The agent stops when it judges coverage sufficient or after a cap of 3 follow-up rounds, then flags remaining gaps to the owner.
6. Owner reviews the full intake record and may add or remove questions before submission is accepted.

**Industry template lifecycle:** the agent drafts a template for a new industry, the owner edits and approves it, and it joins the template library. Templates are versioned; a project keeps the version it started with.
