# Proposal: changes from the owner's review of PR #6

- **Status:** open
- **Date:** 2026-10-09
- **Raised by:** owner (review of PR #6), written up by the agent
- **Task or spec reference:** P5-T05, P5-T06, P5-T07, P2-T04, P2-T11; `docs/spec/00-overview.md`, `03-pipeline-and-gates.md`, `09-deployment-and-handover.md`, `11-owner-console-and-client-dashboard.md`, `14-risks-and-out-of-scope.md`, `15-operations.md`

## Problem

The owner's review of PR #6 asked for two things: review the Alerts, Hosting, Pipelines and Gates decisions, and replace post-handover edits with change requests until the owner closes the project. In the discussion on 2026-10-09 the owner answered the questions below. Hosting and Gates were not discussed and stay as they are.

## Proposed change

All items are the owner's answers. Draft `DECISIONS.md` rows are at the end, to be added by the owner when the proposal is accepted.

1. **Drop the GitHub web-editor flow.** Remove the generic editing guide with demo screenshots, its PDF and the per-project list of content files. While a project is open, edits are change requests only. After close, edits are handled outside the pipeline. The client still receives the README, the handover document and its PDF, and a short "how to ask for changes" note. The read-only dashboard after close shows those.
2. **Freeze change requests when the transfer starts.** Once the ownership transfer begins (the clean-commit push to the client's repo), no new change requests are accepted. Anything already pending is decided (deploy, defer or decline) first. This closes the gap where a request accepted after the transfer would change the owner's copy instead of the client's live site.
3. **Owner alert for client actions.** The owner receives one email for each client change request, PRD change-request note and final-screenshot comment, in addition to the three alerts in D-200.
4. **Run controls in the console.** The owner can retry a failed run, cancel a run and open a failed run's details from the console.
5. **No-progress watchdog.** A run that makes no progress for a set time is stopped. The time is a fixed default per stage kind, set once by the owner (numbers below, not yet given). The token budget stays a progress bar with no automatic stop, as in D-202.
6. **Complete log.** Events (approvals, actions, limit and watchdog stops, emails and notifications) are written to the database as they happen. Build and test console output and other bulky local logs stay on the laptop and are uploaded to the project weekly.

## Open points

- **Watchdog times per stage kind.** The owner asked for different values per stage. Numbers needed for: intake review, requirements, plan, prototype, build round, QC, report, deployment preparation, handover, change-request round.
- **Token budget stop.** The owner chose only the watchdog among the runaway limits. Confirm that the token budget should still never stop a run.
- **What a watchdog stop does.** Proposed, not yet confirmed: the run moves to a "stopped: no progress" state, its working folder is kept, it does not use the one automatic retry, and the owner is emailed.
- **Retention.** D-169 deletes run logs 90 days after close. Decide whether the audit trail (approvals, actions, emails) is kept differently from console output.
- **Weekly upload.** Which job uploads the local logs, where in the project they land (a table or private Storage objects), and what happens if the laptop is off at the weekly time. With local-only console output, a lost laptop loses up to a week of it.
- **Database size.** Event rows are small, but the free Supabase database is limited. If console output ever moves into the database, check the size first.

## Options considered

- Option A: accept all six items as written (the owner's answers), settle the open points, then update the spec and the plan.
- Option B: accept only items 1 and 2 (the handover change) now and leave items 3 to 6 for Phase 2 planning.
- Not chosen: keep the web-editor guide after close; allow change requests after close; hold the whole log locally until the weekly sync.

## Impact

- **Spec files:** `00-overview.md` (post-handover edits row, owner alerts row), `09-deployment-and-handover.md` (handover pack, change-request window), `11-owner-console-and-client-dashboard.md` (run controls, post-close dashboard), `14-risks-and-out-of-scope.md` (remove the "client struggles with GitHub web editor" risk), `15-operations.md` (logging, watchdog, retention).
- **Plan tasks:** P5-T05 (handover agent drops the editing guide), P5-T06 (close), P5-T07 (freeze at transfer start), P5-T10 (transfer script sets the freeze), P2-T04 (runner: watchdog, stop state), P2-T11 (owner client-action emails), plus new console tasks for run controls and the log upload.
- **Data model:** a log or event table and possibly a Storage bucket for uploaded console output; a run state for watchdog stops. Any schema change needs the owner's separate approval.
- **Decisions affected:** D-027, D-090, D-154, D-173, D-200, D-208, D-213, D-219.

## Draft DECISIONS.md rows

| ID | Area | Decision | Reason | Status |
| --- | --- | --- | --- | --- |
| D-229 | Handover | The GitHub web-editor guide, its PDF and the per-project content-file list are dropped. While a project is open, edits are change requests only; after close they are handled outside the pipeline. The client receives a README, the handover document and its PDF, and a short note on how to ask for changes | Owner's choice (review of PR #6). Partly supersedes D-027, D-154 and D-173 | Active |
| D-230 | Change requests | No new change request is accepted once the ownership transfer starts; pending ones are decided first | Owner's choice. Narrows D-090 (window ends at transfer start, not at close) | Active |
| D-231 | Owner alerts | The owner is emailed once for each client change request, PRD note and final-screenshot comment | Owner's choice. Extends D-200 | Active |
| D-232 | Console | The owner can retry, cancel and inspect a failed run from the console | Owner's choice | Active |
| D-233 | Runner | A no-progress watchdog stops a run that makes no progress for a fixed per-stage-kind time set once by the owner. The token budget remains a progress bar with no automatic stop | Owner's choice; numbers pending | Active |
| D-234 | Logging | Events are written to the database as they happen; build and test console output and other bulky local logs stay on the laptop and upload weekly | Owner's choice; retention and upload details pending | Active |
