# Actors and responsibilities

> Originally a snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05). The repo is the source of truth; this file includes the owner-approved decisions D-038 to D-069 recorded in `DECISIONS.md`. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

Three actors share the pipeline, and only the owner can move a project past a gate.

| Actor | Does | Cannot do |
| --- | --- | --- |
| Client | Fills the intake, uploads optional assets, signs off the PRD, views the prototype preview, comments on and approves the prototype, answers questions the owner marks ask-client | Edit site content or code before handover, trigger agents, see internal plans, costs, or the question backlog |
| Owner | Finds clients, issues dashboard access, edits and approves every plan, skill set, prototype, round and report, answers the question backlog, triggers deployment and handover | n/a (full control) |
| Agent system | Runs intake follow-ups, synthesizes the PRD, proposes plan, skills and rounds, builds, runs QC, drafts the report, prepares deployment and handover documents | Advance a stage, deploy, or share anything with the client without an owner approval |

Every agent output is a proposal stored as a versioned artifact. Approval creates an immutable record: who approved, what version, and when.

A project can have several client logins, and any of them can approve. Client approvals are recorded only when made in the dashboard.
