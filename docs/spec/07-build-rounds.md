# Build rounds and question backlog

> Originally a snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05). The repo is the source of truth; this file includes the owner-approved decisions D-038 to D-069 recorded in `DECISIONS.md`. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

The Planner sets the number of rounds from the page count and features in the locked PRD, using a rule of thumb: 5 pages or fewer and no blog is 2 rounds, otherwise 4. The owner can override it and approves the plan.

**Each round follows the same loop:**

1. The Builder (Sonnet 5.5, or Opus 5.5 for rounds the approved plan flags) implements the round's scope on a `round-N` branch in the client repo. It reads the plan, the PRD, earlier round summaries, the owner's answers, and the notes file `.pipeline/NOTES.md`, which agents keep up to date and which never contains the owner's private notes.
2. Before opening the pull request, the build, lint, typecheck and content schema checks must pass.
3. The Builder opens a pull request into `staging`; Vercel attaches a preview, which only the owner views (it stays behind Vercel's login).
4. While building, the Builder logs every question or assumption to the question backlog, with context, the options it considered, and what it assumed. It records an assumption and continues; only a true blocker (something it cannot work around) stops the round and is flagged to the owner.
5. At round end the Builder posts a round summary: what was built, what was assumed, open questions, dependencies added that the plan did not name, and every `<Claim>` marker it added.
6. The owner reviews the preview, the pull request diff and the backlog, answers questions, and marks some as ask-client; the client answers those in the dashboard. For each ask-client answer the owner chooses whether it waits for the next round or triggers an immediate fix on the open pull request.
7. Clients do not see or comment on build-round previews; their feedback is limited to the prototype stage and the final screenshots.
8. The owner decides: Accept merges the pull request into `staging` with a merge commit (keeping every commit) and clears the round's claims; Feedback posts the owner's notes on the pull request and the agent pushes a new version (at most 3 Feedback loops per round); Reject closes the pull request. A merge by the owner's own GitHub account also counts as Accept (a webhook records it, verified and idempotent).
9. After approval the Planner re-plans the remaining rounds using the owner's answers, and the owner approves the updated plan before the next round starts.

**Rules:**

- A round cannot start until the previous round is approved, its backlog is triaged, and the updated plan is approved.
- Assumptions the Builder made stay visible in the backlog until the owner confirms or corrects them.
- Round 1 builds on the approved single-page prototype; later rounds extend pages, content, and polish as the plan defines.
- All round work lives on the `staging` branch. `main`, the Vercel production branch, changes only at deployment preparation, so a site cannot go live early.
- Dependencies named in the approved plan may be added; any others are allowed but flagged in the round summary and need the owner's approval at the round gate. Installs run without install scripts.
- Every factual claim in agent-written copy is wrapped in a `<Claim>` marker that renders normally. Markers stay in `staging` until deployment preparation, where a script strips all cleared ones. QC fails if a marker belongs to a claim the owner has not cleared.

**Command rules (D-130, D-131):** the Builder runs shell commands from an allowlist: limited git (it pushes `round-N` branches, never `main`), package installs without install scripts, build, lint, typecheck, test, Playwright, Lighthouse, and file reads and writes inside the project directory. Two kinds of command pause the run and ask the owner: deleting a directory or many files, and force-pushing or rewriting git history. A waiting run keeps its concurrency slot. Everything else, including other network requests, is refused and logged to the backlog so the owner sees what the Builder wanted.

**Cost (D-138, D-140):** the console shows token use as a progress bar against the plan's token budget. There are no dollar amounts and no warnings.
**Change-request mini-rounds (D-174, D-175):** after go-live an accepted change request runs as a mini-round: the Builder works on a `cr-N` branch with a pull request into `staging`, the owner Accepts, and a deploy step (a hard gate) merges `staging` into `main`. A mini-round gets the round checks only (build, lint, typecheck, content schema), with no QC re-run. The client dashboard shows the request's status (received, accepted, deferred, declined, deployed) and sends no email.
