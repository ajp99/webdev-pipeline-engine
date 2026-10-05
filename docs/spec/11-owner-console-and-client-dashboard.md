# Owner console and client dashboard

> Snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (as of 2026-10-05). From this commit the repo is the source of truth. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

One Next.js app serves both views, split by role. Because alerts are dashboard-only, the owner console centers on an approval queue.

**Owner console:**

- Approval queue with badge counts: every pending artifact, round, backlog item, comment, and change request in one place; each pending gate shows its type (soft, hard, client), the actions Accept, Feedback and Reject, and an overdue badge once its escalate_after_hours passes
- Project list with stage, round, and blockers; pause or resume a project, close it, disable client accounts, and see token cost against the warning threshold
- Artifact editor: edit and approve PRD, plan, skill set, round scope, report, handover documents, with version diff
- Question backlog view: answer, mark as ask-client, or accept the agent's assumption
- Prototype comment inbox: raw client comments, with actions to forward to agent, convert to change request, or dismiss
- Template and skills library manager: review agent-generated templates; skills show a 'Skills ready for generalization review' badge with a diff of the project-local and generalized versions, which the owner approves, edits, or rejects
- Stage run monitor: worker status, logs, and retry
- QC and report viewer

**Client dashboard:**

- Intake form with save-as-you-go, optional asset uploads, follow-up questions, and questions the owner marked ask-client with an answer box
- Progress tracker showing the current stage in plain language
- PRD review and sign-off
- Prototype preview and approval
- Comments on the prototype only; no editing of site content before handover
- Final report summary once the owner chooses to share it

Clients never see internal plans, costs, agent logs, or the question backlog unless the owner marks an item as ask-client.
