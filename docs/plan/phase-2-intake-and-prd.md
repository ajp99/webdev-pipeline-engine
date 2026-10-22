# Phase 2: Intake and PRD

**Status:** not started

**Goal:** Intake templates, owner-entered intake with locked rounds, agent follow-ups, the stage runner, and the PRD with the client's sign-off recorded by the owner. Client login, client email, invites, uploads from clients and industry-template generation are deferred to go-live (D-298, G15, G18).

**Parts (D-244):** The phase has two parts, each with its own gate, owner acceptance and independent review.

- **2a (D-304):** order: P1 carry-over P1-T05 and P1-T06 (owner login and console shell), then P2-T17, P2-T01, P2-T04 with the stub run (D-302), P2-T03, P2-T05, P2-T06, P2-T15, P2-T18, P2-T19, P2-T20, P2-T21, P2-T23, closed by P2-T22. Moved to go-live and marked `[-]`: P2-T02, P2-T11, P2-T12, P2-T13. Gate: a fictional client's intake, entered by the owner, runs through the real stage runner and intake agent to an accepted intake.
- **2b:** P2-T07 to P2-T10, P2-T24, closed by P2-T14 (P2-T16 moves to go-live, G15). Gate: the owner records a fictional client's sign-off of a PRD, with a note naming the channel (D-298).

**Gate (owner accepts this phase when):** Part 2a: a fictional client's intake, entered by the owner, runs through the real stage runner and intake agent to an accepted intake. Part 2b: the owner records a fictional client's sign-off of a PRD with a required note.

**Spec to read:** [04-intake.md](../spec/04-intake.md), [05-requirements-and-change-control.md](../spec/05-requirements-and-change-control.md), [06-agents-skills-tools.md](../spec/06-agents-skills-tools.md), [02-architecture.md](../spec/02-architecture.md)

Rules: work only on this phase's tasks; tick each box when its acceptance criteria are met and add an entry to [PROGRESS.md](PROGRESS.md). Ask the owner before schema changes or dependencies not named in a task. Spec files change only with the owner's approval; propose changes in `docs/proposals/`.

## Tasks

- [x] **P2-T01 Template schema and generic template**  
  Acceptance: Templates are stored as JSON with versions. Question types: short text, long text, single choice, multiple choice, file upload, links. Each question has a `required` flag set by the owner. The console validates edits against the schema and rejects invalid ones with clear errors. A generic approved template exists, including the design section from task P2-T15.

- [-] **P2-T02 Industry template generation and editing (moved to go-live, G18)**  
  Acceptance: The input is the industry name plus the owner's notes. An agent drafts the template; the owner edits it as text (markdown or JSON) in the console, approves it, and it joins the library as a new version. When a project starts, the template's sections are copied into `intake_template_snapshot`, so the project keeps its version.

- [ ] **P2-T03 Client intake form and round states (owner-entered, D-298)**  
  Acceptance: The owner enters the intake in the console, from the client's email or call, in one section per step. Answers save as the owner goes; required fields are enforced at Submit; an explicit Submit per round; the owner can reopen a submitted round until the agent has reviewed it; a reviewed round is locked. Uses `intake_rounds` (open, submitted, reviewed). Files are attached by the owner. There is no client page, client login or client upload in this phase.
  Status note (2026-10-21): built and reviewed; the live check on the owner's laptop is open, so the box stays unticked (D-315). The round rules live in the console code by the owner's choice (go-live G27); uploads are stored but not scanned (G28).

- [x] **P2-T04 Stage runner with a durable queue**  
  Acceptance (D-302): `run(stage, project)` returns a result and the next gate. An approval enqueues the next `stage_runs` row. The runner polls every 15 to 30 seconds and claims a run through one database function that uses `FOR UPDATE SKIP LOCKED`, skips any project that already has a running or waiting run, and marks the run running in the same statement; the partial unique index stays as the backstop. The runner refreshes `heartbeat_at`, and a stale heartbeat (10 minutes) re-queues the run, or marks it `cancelled` when it was `cancel_requested` (D-305). `WORKER_MAX_PARALLEL_PROJECTS` defaults to 1. A failed run is retried once automatically (at most 2 attempts), then fails to the owner's queue. One no-progress watchdog of 20 minutes stops a run that shows no sign of life (streamed output, tool call, file write, commit or command output line); per-stage tiers return when real runs show the need (G16). A stub run (a fake stage with a trivial task on the host) goes through claim, heartbeat, cancel and a stub result before P2-T03 starts.
  Status note (2026-10-21): the queue functions, runner, stub run and Cancel are built. The owner chose one `enqueue_run` function; calling it from an approval is part of `accept_gate` in P2-T18, and the next gate comes from the gate function there. The live stub run on the owner's machine is open.

- [ ] **P2-T05 Intake agent batch review**  
  Acceptance: A plain API call with JSON-schema structured output, not an Agent SDK run (D-275). After the owner submits a round, the agent (Haiku 4.5 to start; in development Gemini Flash on the free tier, D-316) reviews the whole round in one batch and lists at most 8 targeted follow-up questions, then marks the round reviewed (locked). The owner relays the questions to the client and enters the answers as the next round (D-304). Cap of 3 follow-up rounds; after that it flags remaining gaps to the owner. It produces a gap list for the owner. Runs under the watchdog in P2-T04.

- [ ] **P2-T06 Owner intake review and notes**  
  Acceptance: The owner sees the full intake record and gap list. The owner can edit client answers (an edit overwrites the answer, with no history), send a round back to the agent for another review, add or remove questions, keep private notes (owner-only table) that agents read, and accept intake (soft gate). Reject marks the version and starts no run; Feedback is capped at 3 loops, after which only Accept or Reject is available (D-234).

- [ ] **P2-T07 Requirements agent produces the PRD**  
  Acceptance: A plain API call with JSON-schema structured output (D-275). Produces the `prd` artifact (client-visible) as schema-validated JSON with a fixed list of sections, each a markdown string, rendered for the client and the editor, with the privacy policy and cookie notice in the page list and the contact form spam protection choice; no round plan. Also produces an owner-only `prd_notes` artifact with the gap and conflict list. Reads the owner's private notes and never quotes them in anything the client sees.

- [ ] **P2-T08 PRD editor with version diff**  
  Acceptance: The owner edits each section in a markdown text area with a live preview and sees a side-by-side version diff. Every saved version is recorded in the approval log. The agent writes a short summary of what changed for each new version. While the stage is open an edit makes a new version that needs a fresh approval; once the project has advanced, new versions of the PRD are blocked and the change goes through a change request (D-238).

- [ ] **P2-T09 Client PRD review (owner-recorded, D-298)**  
  Acceptance: The console shows the latest client-visible PRD version and the change summary for the owner to send to the client outside the pipeline. The owner records the client's reply: Sign off (one client gate, an approval with role `client`, the owner as giver and a required `evidence_note` naming the channel; the signed version freezes as v1.0) or Request changes with a note stored in `prd_feedback` that goes to the owner, not to agents. There is no client email or client login until go-live (G15).

- [ ] **P2-T10 Change requests (owner-recorded, D-298)**  
  Acceptance: Change-request records with description, affected pages and features, the agent's impact note, and the owner's decision; accepted ones bump the PRD version. The owner enters requests the client sends outside the pipeline, from go-live until the transfer script sets the freeze (D-230); client submission in the dashboard is a go-live item (G15). The owner sets the impact note and the decision.

- [-] **P2-T11 Client email notifications (moved to go-live, G15)**  
  Acceptance: The worker sends clients English emails over SMTP (nodemailer, approved for this task) from the owner's Gmail account with an app password, for four events: intake follow-ups ready, PRD ready, prototype ready, ask-client question waiting. One email per event and no reminders. The owner is also emailed when a gate is ready, when a run is waiting on a pause request, and when a run fails; overdue gates stay a console badge only. Change-request status and final screenshots send no email to the client. The owner is also emailed once for each client change request, PRD note and final-screenshot comment, with the event and a console link only (D-231), and when a client approval makes a project ready to advance (D-234). Every email is recorded in `email_log` with a unique dedupe key that is claimed before sending (the table is already in the migration, D-221), so a retry or restart cannot send it twice. Only the worker sends mail, so emails wait while the laptop is off. The sender, `email_log`, the intake follow-up email and the owner emails ship in part 2a; the PRD-ready email and the owner alert for a PRD note are wired in part 2b with P2-T09 and P2-T10. The owner creates a Gmail app password (this needs 2-step verification) and fills the SMTP settings in the worker's `.env`.

- [-] **P2-T12 Client invites (moved to go-live, G15)**  
  Acceptance: The owner enters the client's email; Supabase sends an invite email with a link to set a password. A project can have several client logins, but one named signer per project whose approval counts at client gates (D-238; the field is `clients.is_signer`, one per project, set by the owner; `0001` and `0002` already enforce it in `advance_stage()` and the client approval policy, so the console only sets the signer when it invites the clients). Client minimum password length is 12 and public sign-ups stay off (D-242). Invite links are valid for as long as Supabase allows (the spec is changed to that cap, D-242) and the console has a Resend invite button. Supabase's invite and password-reset emails use Supabase's custom SMTP with the same Gmail account.

- [-] **P2-T13 Upload scanning and file handling (moved to go-live, G15)**  
  Acceptance: Uploads are scanned for malware in the worker before any agent sees them (the owner installs the scanner on their machine); infected files are quarantined and flagged to the owner. SVG is sanitized, zip is rejected, macro-enabled documents are never opened, and MP4 is treated as an asset only. Allowed types and the 25 MB limit are enforced in the database and in the form.

- [ ] **P2-T14 Phase 2b gate evidence**  
  Acceptance: Record in `PROGRESS.md`: (1) a manual walkthrough with a fictional client (Acme), the owner entering the intake and recording the client's PRD sign-off with an evidence note, from template to signed PRD; (2) an automated end-to-end test (Playwright) of the same flow with model responses stubbed; (3) a cost report from `stage_runs` compared with the estimates in `docs/spec/13-cost.md`.

- [ ] **P2-T15 Design section and style cards**  
  Acceptance: The generic template's design section asks for: 4 style cards (pick 1 or 2) and layout density; up to 3 reference sites with what the client likes about each; colors and font styles with an optional brand guideline upload; imagery style and things to avoid. It also asks about an existing website (one text question: URL, what to keep, what to change) and requires a logo upload or an explicit answer that there is none. An agent proposes 4 distinct style directions (such as minimal, bold, warm, corporate) and the owner approves them; each is built as a standalone sample page rendered to an image the form shows. Site images over 5 MB are rejected at upload.

- [-] **P2-T16 Dashboard basics: privacy page and mobile-first layout (moved to go-live, G15)**  
  Acceptance: The client dashboard is mobile-first and usable on a phone for every client action in this phase. It links to a privacy page that an agent drafts and the owner reviews, naming what is stored, who processes it, the 90-day retention, and that deleted data can remain in backups for up to 180 days; there is no first-login acceptance step.

- [x] **P2-T17 `pnpm doctor` and setup scripts (first task of 2a)**  
  Acceptance: CI already exists from P1-T12 (D-287). `pnpm doctor` checks that the env files are present, migrations are applied and public sign-ups are off. Where the tools allow, each owner step in `docs/plan/phase-1-owner-steps.md` has a script. A consistency test checks that every stage's gating artifact type appears in its `outputs` in `docs/spec/stages.yaml` (D-235, D-241). The free-plan keep-alive request is dropped from this phase and tracked as go-live item G1 (D-243). The docs lint also checks that every ticked task has a `PROGRESS.md` entry (D-315).

- [ ] **P2-T18 Gate functions (migration, own PR)**  
  Acceptance: A database function returns a project's remaining gates and the console calls it instead of the TypeScript rules (`remainingGates` and the drift tests are removed or reduced). The function is owner-only and returns one row per gate (gate type, gatekeeper, state: satisfied, missing or blocked until the owner approves first, artifact and version, due time, overdue flag) and a ready-to-advance flag (D-261). `accept_gate` records the approval and marks the artifact approved, and calls `advance_stage()` in the same transaction only when that approval completes the gates; otherwise it returns that it is waiting on the client, and a client sign-off never advances (D-258). A trigger on `artifacts` refuses a new version of a gated type once the project is past its stage unless the row names an accepted change request of the same project in `change_request_id`; `release_note` and `round_summary` during build rounds are exempt (D-259). The three separate calls in the Accept server action are replaced. Database checks cover both; mutation-check each rule. The owner approves the migration; it ships in its own PR with an independent review (D-239). `accept_gate` and `advance_stage()` are callable only from an owner session, never by the service role or an agent (D-264), and they honour the effective gatekeeper of `gate_config` (D-272).
  Also (from P2-T04): `accept_gate` calls `enqueue_run` in the same transaction when the approval starts the next stage's work.

- [ ] **P2-T19 Gate controls in the console**  
  Acceptance: Reject marks the version rejected, keeps the stage open and starts no run. Feedback works on the soft gates and is capped at 3 loops on intake review, PRD, plan, deployment preparation and handover guide; after the cap only Accept or Reject is shown. The prototype (2), build rounds (3) and QC (2) keep their caps. After a client approval or the last round approval the project shows "Ready to advance" (D-234).

- [ ] **P2-T20 Cancel project (migration, own PR) (cancel only, D-301)**  
  Acceptance: A database function cancels a project from any stage before handover (`close_reason = cancelled`). `cancel_project(project, reason)` refuses an empty reason (stored in `project_internal.cancel_reason`), leaves the stage where it was, marks queued runs `cancelled` and sets running runs to `cancel_requested`; the worker checks the status between turns, aborts the run, and marks it `cancelled`. There is no commands table, no retention timer and no `retention_until` in this phase (D-303, G17). The console has a Cancel button with a typed confirmation. Cancelling stops the project's runs and keeps its data (D-237).

- [ ] **P2-T21 Run controls in the console (retry and cancel only, D-301)**  
  Acceptance: Retry creates a new queued run for the same project and stage with fresh attempts and keeps the old run as history. Cancel stops the run through the `cancel_requested` flag of P2-T20 and keeps the working folder, the branch and any open pull request. A failed or stopped run opens a detail view with the reason and timeline and the last log lines, with Rerun from scratch and End run (D-233). Pause, Resume, parked runs and the commands table (D-249) are deferred (G16).

- [ ] **P2-T22 Phase 2a gate evidence**  
  Acceptance: Record in `PROGRESS.md` (D-304): a walkthrough with a fictional client (Acme), the owner entering the intake, from template to an accepted intake through the real stage runner and intake agent on the local Supabase; an automated test of the same flow with model responses stubbed; a watchdog test (a hung run is stopped); a cancel test (a running run reaches `cancelled`); a cost report from `stage_runs`; and an independent review of the part by a fresh agent and then the owner. For part 2a also the walking skeleton of P2-T23.

- [ ] **P2-T23 Walking skeleton (end of 2a)**  
  Acceptance (D-290): one fictional client goes through template, intake, a stub PRD and a single-page build with a preview, using the real worker, the Builder on the host (D-310) and the database; the Agent SDK session resume is tried here and used only if it works (D-280). The owner reviews it and decides when the pilot moves earlier than the end of Phase 5. Recorded in `PROGRESS.md`.

- [ ] **P2-T24 Approval metrics in the console**  
  Acceptance (D-293): the console shows time to decision per gate and Feedback loops per artifact, computed from existing timestamps, with a test on fixture data.

## Gate

Part 2a is done when **a fictional client's intake, entered by the owner, runs through the real stage runner and intake agent to an accepted intake**; part 2b, and so the phase, when **the owner records a fictional client's sign-off of a PRD with an evidence note**. Only the owner marks either done, by setting **Status** above to `done` and updating `docs/plan/README.md`.
