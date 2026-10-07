# Owner console and client dashboard

> Originally a snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05). The repo is the source of truth; this file includes the owner-approved decisions D-038 to D-069 recorded in `DECISIONS.md`. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

One Next.js app serves both views, split by role. The owner console centers on an approval queue; the owner is also emailed when a gate is ready, a run waits on a pause request, or a run fails.

**Owner console:**

- Approval queue with badge counts: every pending artifact, round, backlog item, comment, and change request in one place; each pending gate shows its type (soft, hard, client), the actions Accept, Feedback and Reject, and an overdue badge once its escalate_after_hours passes
- Project list with stage, round, and blockers; pause or resume a project, close it, disable client accounts, and see token use as a progress bar against the plan's token budget (no warnings)
- Artifact editor: edit and approve PRD, plan, skill set, round scope, report, handover documents, with version diff
- Question backlog view: answer, mark as ask-client, or accept the agent's assumption
- Client notes inbox: raw notes on the prototype and the final screenshots, with actions to forward to agent, convert to change request, or dismiss
- Template and skills library manager: review agent-generated templates; skills show a 'Skills ready for generalization review' badge with a diff of the project-local and generalized versions, which the owner approves, edits, or rejects
- Stage run monitor: worker status, logs, and retry
- QC and report viewer
- Intake review: edit client answers (an edit overwrites, with no history), send a round back to the agent for another review, add or remove questions, and accept intake
- Template editor: edit an industry template as text (markdown or JSON) and approve it
- Private notes per project, read by agents and never shown to clients
- Run log viewer for each stage run
- Client invites: send an invite (valid 7 days) and resend it from a button
- Pause requests: answer a waiting run's request to delete files or rewrite history
- Plan versions: the Planner's re-plan after each round, with a diff, for approval
- Round review: the pull request link, the diff, the preview, the backlog and the round's claims

**Client dashboard:**

- Intake form: one section per step with a progress bar, saving as the client goes; optional uploads; an explicit Submit per round (reopen until the agent has reviewed it); follow-up rounds; and questions the owner marked ask-client with an answer box
- Progress tracker showing the current stage in plain language
- PRD review: the latest version with a summary of what changed; Sign off, or Request changes with a note to the owner
- Prototype screenshots (desktop and mobile) with Approve, or Request changes with a required note
- Final screenshots after QC, with a comment box (a note comes to the owner; approval stays with the owner; no email)
- No editing of site content before handover
- Change requests from go-live until handover is complete, each showing its status (received, accepted, deferred, declined, deployed); no email
- A privacy page the agent drafts and the owner reviews (what is stored, who processes it, the 90-day retention)
- After the handover is marked complete the dashboard is read-only and shows only the handover guide and its PDF
- Mobile-first layout, since clients will often approve from a phone
- Final report summary once the owner chooses to share it

Clients never see internal plans, costs, agent logs, or the question backlog unless the owner marks an item as ask-client.

Clients also receive emails (sent over SMTP from the owner's Gmail) when intake follow-ups, the PRD, the prototype, or an ask-client question is waiting for them.
