# Phase 2: Intake and PRD

**Status:** not started

**Goal:** Industry templates, client intake, agent follow-ups, the stage runner, and the PRD with client sign-off.

**Gate (owner accepts this phase when):** A test client signs off a PRD.

**Spec to read:** [04-intake.md](../spec/04-intake.md), [05-requirements-and-change-control.md](../spec/05-requirements-and-change-control.md), [06-agents-skills-tools.md](../spec/06-agents-skills-tools.md), [02-architecture.md](../spec/02-architecture.md)

Rules: work only on this phase's tasks; tick each box when its acceptance criteria are met and add an entry to [PROGRESS.md](PROGRESS.md). Ask the owner before schema changes or dependencies not named in a task. Spec files are read-only; propose changes in `docs/proposals/`.

## Tasks

- [ ] **P2-T01 Intake template schema and generic template**  
  Acceptance: Template sections (business, audience, goals, pages, tone, competitors, brand, required features) stored in `intake_templates` with versions; a generic approved template exists.

- [ ] **P2-T02 Industry template generation**  
  Acceptance: An agent drafts a template for a new industry; the owner edits and approves it; it becomes available for new projects; a project keeps the version it started with.

- [ ] **P2-T03 Client intake form**  
  Acceptance: Save-as-you-go form with optional asset uploads to private storage (including the storage bucket policies); missing items are flagged, not blocking; clients can only write while the project is in intake and active.

- [ ] **P2-T04 Stage runner with a durable queue**  
  Acceptance: `run(stage, project)` returns a result and the next gate. An approval enqueues the next `stage_runs` row; the runner polls every 15 to 30 seconds and claims a row atomically (`FOR UPDATE SKIP LOCKED`), refreshes `heartbeat_at`, and a stale heartbeat re-queues the run. A runner that was offline finds the queue waiting. The claim function is a schema change the owner approves. Realtime is not used.

- [ ] **P2-T05 Intake agent follow-ups**  
  Acceptance: Posts at most a few targeted follow-ups per round for vague or conflicting answers; stops when coverage is judged sufficient or after 3 follow-up rounds; produces a gap list for the owner.

- [ ] **P2-T06 Owner intake review**  
  Acceptance: Owner sees the full intake record and gap list, can add or remove questions, and accepts intake (soft gate).

- [ ] **P2-T07 Requirements agent produces the PRD**  
  Acceptance: PRD artifact with every section listed in the spec, including privacy policy and cookie notice in the page list and the contact form spam protection choice; gap and conflict list included.

- [ ] **P2-T08 Owner artifact editor with version diff**  
  Acceptance: Owner can edit PRD text, see a version diff, and save a new version; the approval log records the version approved.

- [ ] **P2-T09 Client PRD review and sign-off**  
  Acceptance: Client dashboard shows the PRD (client-visible artifacts only) and a sign-off action; any client login on the project can sign off; the version freezes as v1.0.

- [ ] **P2-T10 Change-request records**  
  Acceptance: Create change requests with description, affected pages and features, impact note, and the owner's decision; accepted ones bump the PRD version.

- [ ] **P2-T11 Client email notifications**  
  Acceptance: Resend emails clients for four events: intake follow-ups ready, PRD ready, prototype ready, ask-client question waiting. The pipeline has its own Resend sender; the owner supplies the sender domain and DNS records. Owner alerts stay dashboard-only.

## Gate

The phase is done when: **A test client signs off a PRD**. Only the owner marks it done, by setting **Status** above to `done` and updating `docs/plan/README.md`.
