# Actors and responsibilities

> **Dev-only scope (D-297 to D-304; proposal 2026-10-19-phase-2a-rebaseline):** until go-live there is no client login. The owner enters intake and records client-gate approvals with a required evidence note. Invites and client accounts do not exist yet. The client-facing design below is the go-live design (G15).

> Originally taken from a Claude Doc (2026-10-05) that has since been retired. The repo is the source of truth; this file reflects the owner-approved decisions recorded in `DECISIONS.md`. Agents change files in `docs/spec/` only after the owner approves a proposal in `docs/proposals/` (see `AGENTS.md`).

Three actors share the pipeline, and only the owner can move a project past a gate.

| Actor | Does | Cannot do |
| --- | --- | --- |
| Client | Fills the intake, uploads optional assets, signs off the PRD or requests changes with a note, views the prototype screenshots and approves them or requests changes with a note, views the final screenshots and comments on them, answers questions the owner marks ask-client, submits change requests during the live period | Edit site content or code before handover, trigger agents, see internal plans, costs, or the question backlog |
| Owner | Finds clients, invites them by email, keeps private notes that agents read, edits and approves every plan, skill set, prototype, round and report, answers the question backlog, triggers deployment and handover | n/a (full control) |
| Agent system | Runs intake follow-ups, synthesizes the PRD, proposes plan, skills and rounds, builds, runs QC, drafts the report, prepares deployment and handover documents | Advance a stage, deploy, or share anything with the client without an owner approval |

Every agent output is a proposal stored as a versioned artifact. Approval creates an immutable record: who approved, what version, and when.

A project can have several client logins, and any of them can approve. Client approvals are recorded only when made in the dashboard.
