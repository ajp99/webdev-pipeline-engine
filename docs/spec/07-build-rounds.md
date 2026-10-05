# Build rounds and question backlog

> Snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (as of 2026-10-05). From this commit the repo is the source of truth. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

The Planner sets the number of rounds from the page count and features in the locked PRD, and the owner approves or changes it. Simple sites land at about 2 rounds, larger ones at about 4.

**Each round follows the same loop:**

1. Builder implements the round's scope in the project repo and deploys a preview.
2. While building, the Builder logs every question or assumption it hits to the project's question backlog, each with context, the options it considered, and what it assumed so work could continue.
3. At round end the Builder posts a round summary: what was built, what was assumed, open questions.
4. The owner reviews the preview and the backlog, answers questions, and decides which ones go to the client, who answer them in the dashboard.
5. Clients do not see or comment on build-round previews; their feedback is limited to the prototype stage.
6. The owner approves the round. The owner's answers and decisions become input to the next round's scope.

**Rules:**

- A round cannot start until the previous round is approved and its backlog is triaged.
- Assumptions the Builder made stay visible in the backlog until the owner confirms or corrects them.
- Round 1 always builds on the approved single-page prototype; later rounds extend pages, content, and polish as the plan defines.
