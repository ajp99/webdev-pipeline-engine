# Phase 4: Build rounds

**Status:** not started

**Goal:** The Builder with a command allowlist, rounds as pull requests into `staging`, the question backlog and ask-client flow, claim markers, the re-plan after each round, token tracking, and the GitHub webhook.

**Gate (owner accepts this phase when):** A full round runs with its backlog triaged.

**Spec to read:** [07-build-rounds.md](../spec/07-build-rounds.md), [06-agents-skills-tools.md](../spec/06-agents-skills-tools.md), [12-security.md](../spec/12-security.md), [11-owner-console-and-client-dashboard.md](../spec/11-owner-console-and-client-dashboard.md)

Rules: work only on this phase's tasks; tick each box when its acceptance criteria are met and add an entry to [PROGRESS.md](PROGRESS.md). Ask the owner before schema changes or dependencies not named in a task. Spec files are read-only; propose changes in `docs/proposals/`.

## Tasks

- [ ] **P4-T01 Round scope, re-plan and gating**  
  Acceptance: Rounds are created from the approved plan. A round cannot start until the previous round is approved, its backlog is triaged, and the updated plan is approved. After each approved round the Planner re-plans the remaining rounds using the owner's answers, and the owner approves the new plan version.

- [ ] **P4-T02 Builder worker with isolation**  
  Acceptance: Runs each stage in a per-project working directory with a short-lived GitHub App token limited to that project's repository (no Vercel token). Uses Sonnet 5.5, or Opus 5.5 for rounds the approved plan flags. Shell commands run from an allowlist: limited git (it pushes `round-N` branches, never `main`), installs without install scripts, build, lint, typecheck, test, Playwright, Lighthouse, and file access inside the project directory. Everything else, including other network requests, is refused and logged to the backlog. Keeps `.pipeline/NOTES.md` in the client repo and never copies the owner's private notes into it.

- [ ] **P4-T03 Pause requests**  
  Acceptance: Deleting a directory or many files, and force-pushing or rewriting git history, pause the run and create a `run_approvals` row; the run enters the `waiting` state and keeps its concurrency slot. The console shows the request and the owner approves or denies it; the run then continues or skips the command.

- [ ] **P4-T04 Round pull request and backlog logging**  
  Acceptance: Each round works on a `round-N` branch. Before the pull request opens, the build, lint, typecheck and content schema checks must pass. The PR goes into `staging`; Vercel attaches a preview (owner only); `rounds` records the branch, PR number and URL. The Builder logs every question and assumption with context, options considered and what it assumed; only a true blocker stops the round and is flagged to the owner.

- [ ] **P4-T05 Claim markers**  
  Acceptance: The Builder wraps every factual claim in a `<Claim>` marker. The round summary lists them in `rounds.claims`; approving the round records `claims_cleared_at`. A QC check fails if a marker belongs to a claim that was not cleared. A script strips all cleared markers at deploy prep (task P5-T04).

- [ ] **P4-T06 Round summary**  
  Acceptance: At round end the Builder posts what was built, what was assumed, open questions, dependencies added that the plan did not name, and the round's claims.

- [ ] **P4-T07 Owner backlog view**  
  Acceptance: The owner can answer questions, mark them ask-client, or accept the agent's assumption. For each ask-client answer the owner chooses `next_round` or `immediate_fix` (an immediate fix run on the open pull request). Assumptions stay visible until confirmed or corrected.

- [ ] **P4-T08 Client ask-client answers**  
  Acceptance: The client dashboard shows only items marked ask-client with an answer box; clients cannot see any other backlog item, any round preview, or any pull request.

- [ ] **P4-T09 Round gate**  
  Acceptance: Accept merges the round's pull request into `staging` with a merge commit (keeping every commit) and clears the round's claims. Feedback posts the owner's notes on the pull request and the agent pushes a new version, at most 3 times per round (`feedback_count`). Reject closes the pull request.

- [ ] **P4-T10 Token tracking**  
  Acceptance: `stage_runs` records tokens used. The console shows a progress bar of token use against the plan's token budget. No dollar amounts and no warnings.

- [ ] **P4-T11 GitHub webhook**  
  Acceptance: An endpoint in `apps/web` verifies GitHub's signature. A merge of a round's pull request into `staging` by the owner's GitHub account is recorded as Accept (idempotent, so a console-triggered merge is not recorded twice). A pull request closed without merging records nothing.

- [ ] **P4-T12 Phase 4 gate evidence**  
  Acceptance: Record in `PROGRESS.md`: two real rounds on the dental fixture with a throwaway repo, exercising a re-plan, Feedback loops, a risky-command pause and an ask-client answer; an automated round-loop test with model and GitHub calls stubbed; table-driven tests of the command allowlist (allowed, refused and paused commands, including attempts to reword a refused one); and a cost report in tokens.

## Gate

The phase is done when: **A full round runs with its backlog triaged**. Only the owner marks it done, by setting **Status** above to `done` and updating `docs/plan/README.md`.
