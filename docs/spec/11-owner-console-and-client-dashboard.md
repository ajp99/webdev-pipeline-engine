# Owner console and client dashboard

> **Dev-only scope (D-297 to D-304; proposal 2026-10-19-phase-2a-rebaseline):** until go-live there is no client login. The owner enters intake and records client-gate approvals with a required evidence note. The client dashboard, invites and privacy page are go-live items. The client-facing design below is the go-live design (G15).

> Originally taken from a Claude Doc (2026-10-05) that has since been retired. The repo is the source of truth; this file reflects the owner-approved decisions recorded in `DECISIONS.md`. Agents change files in `docs/spec/` only after the owner approves a proposal in `docs/proposals/` (see `AGENTS.md`).

One Next.js app serves both views, split by role. The owner console centers on an approval queue; the owner is also emailed when a gate is ready, a project is ready to advance, a run waits on a pause request, or a run fails, and once for each client change request, PRD change-request note or final-screenshot comment (the event and a console link only).

**Owner console:**

- Approval queue with badge counts: every pending artifact, round, backlog item, comment, and change request in one place; each pending gate shows its type (soft, hard, client), the actions Accept, Feedback and Reject, and an overdue badge once its escalate_after_hours passes; a project whose gates are all approved shows "Ready to advance" with an Advance button
- Hard-gate Accept (deploy preparation, handover) asks the owner to type the project name; Accept happens only in the console (D-268, D-279)
- Project list with stage, round, and blockers; pause or resume a project, close it, cancel it (typed confirmation and a reason), disable client accounts, and see token use as a progress bar against the plan's token budget (no warnings), time to decision per gate and Feedback loops per artifact (D-293)
- Artifact editor: edit and approve PRD, plan, skill set, round scope, report, handover documents, with version diff
- Question backlog view: answer, mark as ask-client, or accept the agent's assumption
- Client notes inbox: raw notes on the prototype and the final screenshots, with actions to forward to agent, convert to change request, or dismiss
- Template and skills library manager: review agent-generated templates; skills show a 'Skills ready for generalization review' badge with a diff of the project-local and generalized versions, which the owner approves, edits, or rejects
- Stage run monitor: worker status and logs. A failed or stopped run (a parked run at go-live) opens a detail view with the reason and timeline, the last log lines and the actions Resume, Rerun from scratch and End run; Retry creates a new run with fresh attempts and Cancel stops a run but keeps its folder, branch and pull request
- Retention: an overdue badge and a "Run retention now" button
- QC and report viewer
- Intake review: edit client answers (an edit overwrites, with no history), send a round back to the agent for another review, add or remove questions, and accept intake
- Template editor: edit an industry template as text (markdown or JSON) and approve it
- Private notes per project, read by agents and never shown to clients
- Run log viewer for each stage run
- Client invites: send an invite (valid as long as Supabase allows) and resend it from a button
- Pause requests: answer a waiting run's request to delete files or rewrite history
- Plan versions: the Planner's re-plan after each round, with a diff, for approval
- Round review: the pull request link, the diff, the preview, the backlog and the round's claims

**Client dashboard:**

- Intake form: one section per step with a progress bar, saving as the client goes; optional uploads; an explicit Submit per round (reopen until the agent has reviewed it); follow-up rounds; and questions the owner marked ask-client with an answer box
- Progress tracker showing the current stage in plain language
- PRD review: the latest version with a summary of what changed; Sign off, or Request changes with a note to the owner
- Prototype screenshots (desktop and mobile) with Approve, or Request changes with a required note
- Final screenshots after QC, with a comment box (a note comes to the owner; approval stays with the owner; no email)
- No editing of site content while the project is open; changes go through change requests
- Change requests from go-live until the transfer script sets the freeze, each showing its status (received, accepted, deferred, declined, deployed); no email
- A privacy page the agent drafts and the owner reviews (what is stored, who processes it, the 90-day retention, and that deleted data can remain in backups for up to 180 days)
- After the handover is marked complete the dashboard is read-only and shows only the handover guide and its PDF
- Mobile-first layout, since clients will often approve from a phone
- Final report summary once the owner chooses to share it

Clients never see internal plans, costs, agent logs, or the question backlog unless the owner marks an item as ask-client.

Clients also receive emails (sent over SMTP from the owner's Gmail) when intake follow-ups, the PRD, the prototype, or an ask-client question is waiting for them.
**What clients can do, and when (D-216 to D-218):** client writes are accepted only while the project is `active`, and each is tied to its stage: sign-off on the PRD during requirements and approval of the prototype during prototype (both by the project's named client signer), uploads only while an intake round is open (and deleted only then), ask-client answers during build rounds and handover, prototype notes during prototype, final-screenshot notes during deploy prep, and change requests during handover, until the transfer script sets the freeze. The database enforces this, not only the screens. A paused project still shows what a client could read; a closed project shows only the handover guide.
