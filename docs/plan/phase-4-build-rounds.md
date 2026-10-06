# Phase 4: Build rounds

**Status:** not started

**Goal:** The Builder agent, the round loop, the question backlog, and cost tracking.

**Gate (owner accepts this phase when):** A full round runs with its backlog triaged.

**Spec to read:** [07-build-rounds.md](../spec/07-build-rounds.md), [06-agents-skills-tools.md](../spec/06-agents-skills-tools.md), [12-security.md](../spec/12-security.md), [11-owner-console-and-client-dashboard.md](../spec/11-owner-console-and-client-dashboard.md)

Rules: work only on this phase's tasks; tick each box when its acceptance criteria are met and add an entry to [PROGRESS.md](PROGRESS.md). Ask the owner before schema changes or dependencies not named in a task. Spec files are read-only; propose changes in `docs/proposals/`.

## Tasks

- [ ] **P4-T01 Round scope from the plan**  
  Acceptance: Rounds are created from the approved plan; a round cannot start until the previous round is approved and its backlog is triaged.

- [ ] **P4-T02 Builder worker with isolation**  
  Acceptance: Runs each stage in a per-project working directory with a short-lived GitHub App token limited to that project's repository (no Vercel token); cannot touch other projects' repos; destructive commands require owner approval.

- [ ] **P4-T03 Round pull request and backlog logging**  
  Acceptance: Each round works on a `round-N` branch and opens a pull request into `staging`; Vercel's Git integration attaches a preview, and `rounds` records the branch, PR number and URL. The Builder logs every question and assumption with context, options considered, and what it assumed.

- [ ] **P4-T04 Round summary**  
  Acceptance: At round end the Builder posts what was built, what was assumed, and open questions.

- [ ] **P4-T05 Owner backlog view**  
  Acceptance: Owner can answer questions, mark them ask-client, or accept the agent's assumption; assumptions stay visible until confirmed or corrected.

- [ ] **P4-T06 Client ask-client answers**  
  Acceptance: Client dashboard shows only items marked ask-client with an answer box; clients cannot see any other backlog item or any round preview.

- [ ] **P4-T07 Round gate**  
  Acceptance: Owner approves each round (soft gate). Accept merges the round's pull request into `staging`; Feedback posts the owner's notes on the pull request and the agent pushes a new version; Reject closes it. The owner's answers and decisions feed the next round's scope.

- [ ] **P4-T08 Cost tracking and warning**  
  Acceptance: `stage_runs` records tokens and cost; the owner sets a per-project warning threshold; a warning shows near it; nothing pauses automatically.

- [ ] **P4-T09 GitHub webhook**  
  Acceptance: An endpoint in `apps/web` verifies GitHub's signature. A merge of a round's pull request into `staging` by the owner's GitHub account is recorded as Accept (idempotent, so a console-triggered merge is not recorded twice). A pull request closed without merging records nothing.

## Gate

The phase is done when: **A full round runs with its backlog triaged**. Only the owner marks it done, by setting **Status** above to `done` and updating `docs/plan/README.md`.
