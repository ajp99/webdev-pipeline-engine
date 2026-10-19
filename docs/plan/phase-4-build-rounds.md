# Phase 4: Build rounds

**Status:** not started

**Goal:** The Builder with a command allowlist, rounds as pull requests into `staging`, the question backlog and ask-client flow, claim markers, the re-plan after each round, and token tracking (the GitHub webhook was dropped, D-279).

**Gate (owner accepts this phase when):** A full round runs with its backlog triaged.

**Spec to read:** [07-build-rounds.md](../spec/07-build-rounds.md), [06-agents-skills-tools.md](../spec/06-agents-skills-tools.md), [12-security.md](../spec/12-security.md), [11-owner-console-and-client-dashboard.md](../spec/11-owner-console-and-client-dashboard.md)

Rules: work only on this phase's tasks; tick each box when its acceptance criteria are met and add an entry to [PROGRESS.md](PROGRESS.md). Ask the owner before schema changes or dependencies not named in a task. Spec files change only with the owner's approval; propose changes in `docs/proposals/`.

## Tasks

- [ ] **P4-T01 Round scope, re-plan and gating**  
  Acceptance: Rounds are created from the approved plan. A round cannot start until the previous round is approved, its backlog is triaged, and the updated plan is approved. After each approved round the Planner re-plans the remaining rounds using the owner's answers, and the owner approves the new plan version.

- [ ] **P4-T02 Builder worker with isolation**  
  Acceptance: Runs the Builder in its own container (no host mounts other than its repo working copy, non-root, scrubbed environment; the network is open until go-live and the isolation of the other agents is a go-live item, D-300, G19) with a per-project working directory and a short-lived GitHub App token limited to that project's repository (no Vercel token). Uses Sonnet 5.5, or Opus 5.5 for rounds the approved plan flags. Shell commands run from an allowlist: limited git (it pushes `round-N` branches, never `main`), installs with a frozen lockfile and with install scripts, only inside the container (D-286), build, lint, typecheck, test, Playwright, Lighthouse, and file access inside the project directory. Everything else, including other network requests, is refused and logged to the backlog. Keeps `.pipeline/NOTES.md` in the client repo and never copies the owner's private notes into it. A package that is not in the plan and not on the curated allowlist is flagged and needs the owner's approval (D-286).

- [ ] **P4-T03 Pause requests**  
  Acceptance: Deleting a directory or many files, and force-pushing or rewriting git history, pause the run and create a `run_approvals` row; the run enters the `waiting` state and keeps its concurrency slot until the owner answers; parking after a wait (state saved, slot freed) is a go-live item (D-301, G16). Waiting runs are exempt from the no-progress watchdog. The console shows the request and the owner approves or denies it; the run then continues or skips the command.

- [ ] **P4-T04 Round pull request and backlog logging**  
  Acceptance: Each round works on a `round-N` branch. Before the pull request opens, the build, lint, typecheck and content schema checks must pass. The PR goes into `staging`; Vercel attaches a preview (owner only); `rounds` records the branch, PR number and URL. The Builder logs every question and assumption with context, options considered and what it assumed; only a true blocker stops the round and is flagged to the owner.

- [ ] **P4-T05 Claim markers**  
  Acceptance: A claim scan (numbers, award, certified, licensed, guarantee, since, %) runs over agent-written copy and an LLM verifier checks each hit against the PRD and intake (D-284). The Builder wraps every factual claim in a `<Claim>` marker. The round summary lists them in `rounds.claims`; approving the round records `claims_cleared_at`. A QC check fails if a marker belongs to a claim that was not cleared. A script strips all cleared markers at deploy prep (task P5-T04).

- [ ] **P4-T06 Round summary**  
  Acceptance: At round end the Builder posts what was built, what was assumed, open questions, dependencies added that the plan did not name, and the round's claims, and the lockfile diff: packages added or changed, their versions and which have install scripts (D-286).

- [ ] **P4-T07 Owner backlog view**  
  Acceptance: The owner can answer questions, mark them ask-client, or accept the agent's assumption. For each ask-client answer the owner chooses `next_round` or `immediate_fix` (an immediate fix run on the open pull request). Assumptions stay visible until confirmed or corrected.

- [ ] **P4-T08 Client ask-client answers (owner-entered, D-298)**  
  Acceptance: The owner marks backlog items ask-client, relays them to the client outside the pipeline, and enters the client's answer with a note. The client sees nothing in the pipeline: the client dashboard that shows only ask-client items with an answer box is a go-live item (G15).

- [ ] **P4-T09 Round gate**  
  Acceptance: Accept merges the round's pull request into `staging` with a merge commit (keeping every commit) and clears the round's claims. Accept happens only in the console; merging the pull request in GitHub does not count as Accept (D-279). The owner reviews the diff of `.pipeline/NOTES.md` at the gate (D-267). Feedback posts the owner's notes on the pull request and the agent pushes a new version, at most 3 times per round (`feedback_count`). Reject closes the pull request.

- [ ] **P4-T10 Token tracking**  
  Acceptance: `stage_runs` records tokens used. The console shows a progress bar of token use against the plan's token budget. No dollar amounts and no warnings.

- [x] **P4-T11 GitHub webhook (dropped)**  
  Dropped by D-279: Accept happens only in the console, so there is no webhook endpoint and no webhook credential. D-058 is superseded.

- [ ] **P4-T12 Phase 4 gate evidence**  
  Acceptance: Record in `PROGRESS.md`: two real rounds on the dental fixture with a throwaway repo, exercising a re-plan, Feedback loops, a risky-command pause and an ask-client answer; an automated round-loop test with model and GitHub calls stubbed; table-driven tests of the command allowlist (allowed, refused and paused commands, including attempts to reword a refused one); and a cost report in tokens.

- [ ] **P4-T13 Reader stage**  
  Acceptance (D-267): a step with no tools turns the client's text, uploads and reference screenshots into schema-validated fields, and the Builder receives only those fields, never raw client content. Prompt-injection fixtures (P3-T10) show a hostile client message does not reach the Builder as an instruction.

## Gate

The phase is done when: **A full round runs with its backlog triaged**. Only the owner marks it done, by setting **Status** above to `done` and updating `docs/plan/README.md`.
