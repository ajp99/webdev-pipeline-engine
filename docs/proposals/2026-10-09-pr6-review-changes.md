# Proposal: changes from the owner's review of PR #6

- **Status:** open
- **Date:** 2026-10-09
- **Raised by:** owner (review of PR #6), written up by the agent
- **Task or spec reference:** P2-T04, P2-T11, P5-T05, P5-T06, P5-T07, P5-T10; `docs/spec/00-overview.md`, `03-pipeline-and-gates.md`, `09-deployment-and-handover.md`, `11-owner-console-and-client-dashboard.md`, `14-risks-and-out-of-scope.md`, `15-operations.md`

## Problem

The owner's review of PR #6 asked for two things: review the Alerts, Hosting, Pipelines and Gates decisions, and replace post-handover edits with change requests until the owner closes the project. The owner answered the questions below on 2026-10-09. Hosting was not otherwise discussed and stays as it is.

## Proposed change

Every item is an answer the owner gave in the discussion. Draft `DECISIONS.md` rows are at the end, for the owner to add when the proposal is accepted.

### Handover and change requests

1. **Drop the GitHub web-editor flow.** Remove the generic editing guide with demo screenshots, its PDF and the per-project list of content files. While a project is open, edits are change requests only; after close they are handled outside the pipeline. The client still receives the README, the handover document and its PDF, and a short "how to ask for changes" note. The read-only dashboard after close shows those.
2. **Freeze change requests when the transfer starts.** The owner-run transfer script sets the freeze automatically before it pushes the clean commit to the client's repo. From then on no new change request is accepted; anything pending is decided (deploy, defer or decline) first.

### Alerts

3. **Client actions email the owner.** One email for each client change request, PRD change-request note and final-screenshot comment, containing the event and a console link only (no client text). Extends the three alerts in D-200.
4. **No change:** the owner chose to leave the silent-worker-offline case and silent scheduled-job failures (backup, retention, scan) as they are.

### Runner and run controls

5. **No-progress watchdog.** A run that shows no sign of life for a set time is stopped. Any streamed model output, tool call, file write, commit or command output line counts as a sign of life. Times, fixed once and applied to every project:

| Run kind | Minutes without progress |
| --- | --- |
| Industry template generation, intake batch review, PRD, Planner | 10 |
| Prototype, QC runner, reporter and final screenshots, handover agent, deployment preparation | 20 |
| Build round, change-request mini-round (`cr-N`) | 45 |

6. **Waiting runs.** A run waiting for the owner (pause request or ask-client question) is exempt from the watchdog. After 1 hour of waiting it is parked: the worker saves its state and frees the slot, and the run resumes when the owner answers.
7. **New status `stopped`.** A watchdog-stopped run gets a new `stopped` status with a reason and is never retried automatically. This adds a value to the run status list, a migration that needs the owner's separate approval.
8. **Token budget stays a progress bar.** It never stops a run (D-202 unchanged). Only the watchdog and the owner's Cancel stop a run.
9. **Run controls in the console.**
   - Retry creates a new queued run for the same project and stage with fresh attempts. The old run stays as history and the limit of 2 attempts per run is unchanged.
   - Cancel stops the run and keeps the working folder, the branch and any open round pull request.
   - A failed or stopped run opens a detail view with the reason and timeline, the last log lines and action buttons (Resume, Rerun from scratch, End run).

### Gates

10. **Reject only marks.** Reject marks the version rejected and the stage stays open. No agent run starts; the owner then uses Feedback or edits by hand.
11. **Feedback cap of 3** on the soft gates that have none today: intake review, PRD, plan, deployment preparation and handover guide. After 3 loops only Accept or Reject is available. The prototype (2), build rounds (3) and QC (2) keep their caps.
12. **Advance stays an explicit click.** After a client approval or the last round approval the project shows "Ready to advance" and the owner is emailed, as for any gate that is ready.

## Defaults used where the owner had no preference

Please confirm or change these.

- After a stop, the owner chooses in the console between Resume from the working folder, Rerun from scratch and End run.
- The watchdog runs as a timer in the worker plus a database check that marks a run stopped when its heartbeat has been stale for 10 minutes, so a sleeping or hung worker is also caught.

## Open points

- **Logging.** The owner asked to remove the logging requirement (a complete log of actions, events, emails, notifications and build and test console output, with local logs uploaded weekly) from this PR for now. Nothing is proposed. Existing logs are unchanged: `run_logs` rows, `email_log`, `approvals`.
- **Vercel plan.** The spec has client sites on Vercel under the owner's account first. As far as the spec author knows, Vercel's free plan is for non-commercial use; this is unverified. Check Vercel's terms before the pilot and budget a paid seat if needed.
- **Parked runs.** Whether a parked run needs its own status or stays `waiting` with the slot released is not decided.
- **Link between a retried run and the old one.** A `retry_of` column would help the console show history; it is optional and would be a schema change.
- **Hosting** and the remaining gate decisions in the Phase 1 questionnaire are untouched.

## Options considered

- Option A: accept all items above, then update the spec, the plan and the data model.
- Option B: accept only items 1 and 2 (the handover change) now and take the rest in Phase 2 planning.
- Not chosen: keep the web-editor guide after close; allow change requests after close; a hard stop or an email at the token budget; a separate watcher process; resetting attempts on the same run row.

## Impact

- **Spec files:** `00-overview.md` (post-handover edits row, owner alerts row, runner row), `03-pipeline-and-gates.md` (Reject, Feedback caps, Advance), `09-deployment-and-handover.md` (handover pack, change-request window), `11-owner-console-and-client-dashboard.md` (run controls, post-close dashboard), `14-risks-and-out-of-scope.md` (remove the "client struggles with GitHub web editor" risk), `15-operations.md` (watchdog, parked runs).
- **Plan tasks:** P5-T05 (handover agent drops the editing guide), P5-T06 (close), P5-T07 and P5-T10 (freeze set by the transfer script), P2-T04 (runner: watchdog, stopped and parked states), P2-T11 (owner client-action emails), plus a console task for run controls and the Feedback cap on the affected gates.
- **Data model:** `stopped` added to the run status list; optional `retry_of` on `stage_runs`. Any schema change needs the owner's separate approval and its own PR.
- **Decisions affected:** D-027, D-090, D-154, D-173, D-200, D-202, D-208, D-213, D-219.

## Draft DECISIONS.md rows

| ID | Area | Decision | Reason | Status |
| --- | --- | --- | --- | --- |
| D-229 | Handover | The GitHub web-editor guide, its PDF and the per-project content-file list are dropped. While a project is open, edits are change requests only; after close they are handled outside the pipeline. The client receives a README, the handover document and its PDF, and a short note on how to ask for changes | Owner's choice (review of PR #6). Partly supersedes D-027, D-154 and D-173 | Active |
| D-230 | Change requests | The owner-run transfer script sets a freeze before it pushes; from then on no new change request is accepted and pending ones are decided first | Owner's choice. Narrows D-090 (the window ends at transfer start, not at close) | Active |
| D-231 | Owner alerts | The owner is emailed once for each client change request, PRD note and final-screenshot comment; the email names the event and links to the console, with no client text | Owner's choice. Extends D-200 | Active |
| D-232 | Runner | A no-progress watchdog stops a run after 10 minutes (template generation, intake review, PRD, Planner), 20 minutes (prototype, QC, reporter, handover agent, deployment preparation) or 45 minutes (build rounds, change-request rounds) without a sign of life. Waiting runs are exempt and are parked after 1 hour. A stopped run gets a new `stopped` status and is not retried automatically. The token budget never stops a run | Owner's choice; needs a migration the owner approves. Extends D-202 | Active |
| D-233 | Console | Retry creates a new run with fresh attempts and keeps the old run as history. Cancel stops the run and keeps the folder, branch and pull request. A failed or stopped run shows its reason and timeline, last log lines, and Resume, Rerun from scratch and End run | Owner's choice | Active |
| D-234 | Gates | Reject only marks the version rejected and starts no run. Feedback is capped at 3 loops on intake review, PRD, plan, deployment preparation and handover guide. Advance stays an explicit click, and the owner is emailed when a project is ready to advance | Owner's choice | Active |
