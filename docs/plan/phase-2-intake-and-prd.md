# Phase 2: Intake and PRD

**Status:** not started

**Goal:** Industry templates, client intake with locked rounds, agent follow-ups, the stage runner, uploads, client invites and emails, and the PRD with client sign-off.

**Gate (owner accepts this phase when):** A test client signs off a PRD.

**Spec to read:** [04-intake.md](../spec/04-intake.md), [05-requirements-and-change-control.md](../spec/05-requirements-and-change-control.md), [06-agents-skills-tools.md](../spec/06-agents-skills-tools.md), [02-architecture.md](../spec/02-architecture.md)

Rules: work only on this phase's tasks; tick each box when its acceptance criteria are met and add an entry to [PROGRESS.md](PROGRESS.md). Ask the owner before schema changes or dependencies not named in a task. Spec files are read-only; propose changes in `docs/proposals/`.

## Tasks

- [ ] **P2-T01 Template schema and generic template**  
  Acceptance: Templates are stored as JSON with versions. Question types: short text, long text, single choice, multiple choice, file upload, links. Each question has a `required` flag set by the owner. The console validates edits against the schema and rejects invalid ones with clear errors. A generic approved template exists, including the design section from task P2-T15.

- [ ] **P2-T02 Industry template generation and editing**  
  Acceptance: The input is the industry name plus the owner's notes. An agent drafts the template; the owner edits it as text (markdown or JSON) in the console, approves it, and it joins the library as a new version. When a project starts, the template's sections are copied into `intake_template_snapshot`, so the project keeps its version.

- [ ] **P2-T03 Client intake form and round states**  
  Acceptance: One section per step with a progress bar; answers save as the client goes; required fields are enforced at Submit; an explicit Submit per round; the client can reopen a submitted round until the agent has reviewed it; a reviewed round is locked. Uses `intake_rounds` (open, submitted, reviewed) and the RLS from the migration. Storage bucket policies for uploads are included.

- [ ] **P2-T04 Stage runner with a durable queue**  
  Acceptance: `run(stage, project)` returns a result and the next gate. An approval enqueues the next `stage_runs` row. The runner polls every 15 to 30 seconds and claims a row atomically (`FOR UPDATE SKIP LOCKED`), refreshes `heartbeat_at`, and a stale heartbeat re-queues the run. At most one run per project at a time and at most `WORKER_MAX_PARALLEL_PROJECTS` (default 2) projects in parallel. A failed run is retried once automatically (at most 2 attempts), then fails to the owner's queue. No time limit. Each run writes text lines to `run_logs`. The claim function is a schema change the owner approves. Realtime is not used.

- [ ] **P2-T05 Intake agent batch review**  
  Acceptance: After a round is submitted, the agent (Haiku 4.5 to start) reviews the whole round in one batch and posts at most 8 targeted follow-up questions, then marks the round reviewed (locked) and opens a follow-up round. Cap of 3 follow-up rounds; after that it flags remaining gaps to the owner. It produces a gap list for the owner.

- [ ] **P2-T06 Owner intake review and notes**  
  Acceptance: The owner sees the full intake record and gap list. The owner can edit client answers (an edit overwrites the answer, with no history), send a round back to the agent for another review, add or remove questions, keep private notes (owner-only table) that agents read, and accept intake (soft gate).

- [ ] **P2-T07 Requirements agent produces the PRD**  
  Acceptance: Produces the `prd` artifact (client-visible) as a fixed list of structured sections, each in markdown, with the privacy policy and cookie notice in the page list and the contact form spam protection choice; no round plan. Also produces an owner-only `prd_notes` artifact with the gap and conflict list. Reads the owner's private notes and never quotes them in anything the client sees.

- [ ] **P2-T08 PRD editor with version diff**  
  Acceptance: The owner edits each section in a markdown text area with a live preview and sees a side-by-side version diff. Every saved version is recorded in the approval log. The agent writes a short summary of what changed for each new version.

- [ ] **P2-T09 Client PRD review**  
  Acceptance: The client dashboard shows the latest client-visible PRD version and the change summary. The client can Sign off (one client gate; any client login on the project; the signed version freezes as v1.0) or Request changes with a note stored in `prd_feedback` that goes to the owner, not to agents. A new version emails the client again.

- [ ] **P2-T10 Change requests**  
  Acceptance: Change-request records with description, affected pages and features, the agent's impact note, and the owner's decision; accepted ones bump the PRD version. Clients can submit change requests in the dashboard from go-live until handover is complete (the handover stage); clients cannot set the impact note or the decision.

- [ ] **P2-T11 Client email notifications**  
  Acceptance: The worker sends clients English emails over SMTP (nodemailer, approved for this task) from the owner's Gmail account with an app password, for four events: intake follow-ups ready, PRD ready, prototype ready, ask-client question waiting. One email per event and no reminders. The owner is also emailed when a gate is ready, when a run is waiting on a pause request, and when a run fails; overdue gates stay a console badge only. Change-request status and final screenshots send no email. Every email is recorded in `email_log` with a unique dedupe key that is claimed before sending (the table is already in the migration, D-221), so a retry or restart cannot send it twice. Only the worker sends mail, so emails wait while the laptop is off. The owner creates a Gmail app password (this needs 2-step verification) and fills the SMTP settings in the worker's `.env`.

- [ ] **P2-T12 Client invites**  
  Acceptance: The owner enters the client's email; Supabase sends an invite email with a link to set a password. A project can have several client logins, any of which can approve. Invite links are valid for 7 days and the console has a Resend invite button. Supabase's invite and password-reset emails use Supabase's custom SMTP with the same Gmail account.

- [ ] **P2-T13 Upload scanning and file handling**  
  Acceptance: Uploads are scanned for malware in the worker before any agent sees them (the owner installs the scanner on their machine); infected files are quarantined and flagged to the owner. SVG is sanitized, zip is rejected, macro-enabled documents are never opened, and MP4 is treated as an asset only. Allowed types and the 25 MB limit are enforced in the database and in the form.

- [ ] **P2-T14 Phase 2 gate evidence**  
  Acceptance: Record in `PROGRESS.md`: (1) a manual walkthrough with the owner as the test client from a second email, using a fictional client, from template to signed PRD; (2) an automated end-to-end test (Playwright) of the same flow with model responses stubbed; (3) a cost report from `stage_runs` compared with the estimates in `docs/spec/13-cost.md`.

- [ ] **P2-T15 Design section and style cards**  
  Acceptance: The generic template's design section asks for: 4 style cards (pick 1 or 2) and layout density; up to 3 reference sites with what the client likes about each; colors and font styles with an optional brand guideline upload; imagery style and things to avoid. It also asks about an existing website (one text question: URL, what to keep, what to change) and requires a logo upload or an explicit answer that there is none. An agent proposes 4 distinct style directions (such as minimal, bold, warm, corporate) and the owner approves them; each is built as a standalone sample page rendered to an image the form shows. Site images over 5 MB are rejected at upload.

- [ ] **P2-T16 Dashboard basics: privacy page and mobile-first layout**  
  Acceptance: The client dashboard is mobile-first and usable on a phone for every client action in this phase. It links to a privacy page that an agent drafts and the owner reviews, naming what is stored, who processes it, the 90-day retention, and that deleted data can remain in backups for up to 180 days; there is no first-login acceptance step.

## Gate

The phase is done when: **A test client signs off a PRD**. Only the owner marks it done, by setting **Status** above to `done` and updating `docs/plan/README.md`.
