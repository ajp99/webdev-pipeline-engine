# Operations

> Originally taken from a Claude Doc (2026-10-05) that has since been retired. The repo is the source of truth; this file reflects the owner-approved decisions recorded in `DECISIONS.md`. Agents change files in `docs/spec/` only after the owner approves a proposal in `docs/proposals/` (see `AGENTS.md`).

This file collects the decisions made after the original spec snapshot that are about running the pipeline rather than the pipeline's stages. Decision IDs refer to `DECISIONS.md`.

## Dev-only period and go-live (D-263, D-296)

Until go-live, development, tests and the pilot use a local Supabase (Supabase CLI and Docker) with no hosted project and no real clients. Client-facing hosting and notification work stays in the plan and is exercised with a second owner-controlled test account. Every deferred item is on the go-live readiness checklist, `docs/plan/go-live-readiness.md`, which is a Phase 5 gate item.

## Project setup and access (D-059, D-060)

- An **owner-run provisioning script** sets up each project: creates the client repo from `templates/master-starter`, installs the GitHub App on that repo, creates and links the Vercel project (production branch `main`, previews from `staging`), and records `github_repo` and `vercel_project_id` in `projects`.
- Workers get a **GitHub App** token: short-lived and limited to one client repository, created per run. Workers hold **no Vercel token**; Vercel deploys through its Git integration and previews are read from the GitHub deployment status.
- The owner sets production environment variables and domains in Vercel at deployment preparation, from an agent-written checklist.

## Notifications and mail (D-045, D-156, D-167, D-168, D-200, D-231, D-234)

Clients receive emails for four events: intake follow-ups ready, PRD ready, prototype ready, and an ask-client question waiting. The pipeline sends them over SMTP from the owner's Gmail account with an app password, and Supabase's invite and password-reset emails use the same Gmail through Supabase's custom SMTP. The owner is emailed when a gate is ready, when a project is ready to advance, when a run is waiting on a pause request, and when a run fails, and once for each client change request, PRD change-request note and final-screenshot comment (the event and a console link only, no client text); overdue gates stay a console badge only. Change-request status and final screenshots send no email to the client. Resend is not used unless a PRD names it. Every email is recorded in `email_log` with a unique dedupe key claimed before sending (D-221), and only the worker sends mail, so emails wait while the laptop is off (D-224). Gmail needs 2-step verification to create an app password and limits daily sending.

## Backups (D-049, D-062, D-069)

The database is exported on a schedule and before each project close. Exports are encrypted, saved locally, and copied to the owner's own cloud drive. They never go into this repo. The key is kept in a password manager. Each export is deleted 180 days after it is made (D-222), so deleted client data can remain in backups for up to 180 days; the privacy page says so. The script points at the local database in the dev-only period. One restore of an export into a scratch database is proved in Phase 1 (D-294); there is no regular restore drill.

## Agent evals (D-065, D-067, D-068)

An automated eval harness with a judge model (Opus 5.5) runs fictional client fixtures stored in `evals/`. It runs when prompts or models change, not on every commit (before the Planner exists there is no automated check on a prompt or model change, and model IDs are pinned with `prompt_hash` logged, D-283), and its scores are calibrated against the owner's spot checks. The Planner (skill selection and round plan) is evaluated first. Fixtures contain no real client data because the repo is public. They include prompt-injection cases for the reader step (D-267).

## Pilot (D-064)

A walking skeleton is built by the end of Phase 2a: one fictional client through template, intake, a stub PRD and a single-page build with a preview, using the real worker, container and database (D-290). The pilot may move earlier than the end of Phase 5; its point is decided when the skeleton is reviewed. The pilot is the owner's own site, with the owner playing the client from a second email account. It runs up to deployment on the Vercel address and then a handover to a second GitHub account; there is no custom domain, so the DNS steps are first exercised on a real client (D-172). A dry run of the handover script on a throwaway repo happens at the start of Phase 5, before the pilot (D-250). Measures: token cost per project against the estimate in `13-cost.md`, owner time per stage, Feedback loops per gate, first-try Lighthouse pass, and defects found after go-live.

## Repo hygiene and CI (D-046, D-240)

GitHub secret scanning and push protection are to be turned on (P1-T11). CI starts in Phase 1 (task P1-T12, D-287): GitHub Actions workflows run lint, typecheck, unit tests, the database checks on a Postgres service and on the local Supabase stack, and a docs lint (placeholders, decision-ID continuity, broken links, D-291), with no secrets. A scripted mutation check runs on every PR that touches `supabase/**` and before each phase gate (D-288). Worker tests are fakes and unit tests only. CODEOWNERS covers `supabase/migrations/**`. Secret scanning and push protection are to be turned on and the old personal access token revoked (P1-T11, D-292). Branch protection stays the owner's call; until the workflow is merged and green, an agent's report that tests pass is unverified.

## MCP server (D-055, D-057, D-177)

A read-only MCP server would let the owner ask Claude about status, the approval queue, the backlog, and cost. It cannot approve, answer, or change anything, because a prompt-injected client message must never be able to approve a gate through chat. The owner is not sure it is needed, so it stays optional and is decided after the pilot (task P5-T08 is deferred until then).

## Supabase MCP server (D-246, D-274)

`.mcp.json` points at the local Supabase stack and is read-only; it does not point at a hosted project. Agents use it for reads and documentation only. Any write through it (data, schema, functions, storage, branches, migrations) needs the owner's approval first.

## Runner behavior (D-081 to D-085)

- At most one ticket per project at a time, and at most 1 project in parallel by default (`WORKER_MAX_PARALLEL_PROJECTS`, D-302). Until go-live there is one 20-minute no-progress watchdog; the per-kind tiers below return at go-live (G16).
- A failed run is retried once automatically (at most 2 attempts), then fails to the owner's queue. A stale heartbeat (10 minutes: the worker went away or the laptop slept) re-queues the run within those 2 attempts.
- **No-progress watchdog (D-232):** a run that shows no sign of life is stopped. Any streamed model output, tool call, file write, commit or command output line counts, and so does each backoff retry after a rate-limit or overload response (D-204). Limits by run kind: 10 minutes for industry template generation, intake batch review, the PRD and the Planner; 20 minutes for the prototype, the QC runner, the reporter and final screenshots, the handover agent and deployment preparation; 45 minutes for build rounds and change-request mini-rounds. A stopped run gets the status `stopped` with a reason and is never retried automatically.
- A run waiting for the owner (a pause request or an ask-client question) is exempt from the watchdog and keeps its slot for up to 1 hour. It is then parked: the worker saves its state, sets the status `parked` and `parked_at` and frees the slot, and the run resumes when the owner answers.
- The token budget is a progress bar and never stops a run. Only the watchdog, a hard wall-clock cap (about 2 times the watchdog limit for the run's kind), a turn limit and the owner's Cancel do. Spend gets alerts only: no token-based kill and no hard spend cap (accepted risk, D-276).
- **Claim function and unique run (D-278):** every `stage_runs` status change goes through the claim and transition function, and a partial unique index allows one running or waiting run per project.
- **Idempotent retries (D-277):** the pull request is found or created by branch, external calls carry idempotency keys, a step journal is kept in `run_logs`, and work is committed before each side effect.
- **Tracing (D-281):** `stage_runs` and `run_logs` carry a `trace_id`; logs are structured lines with project, stage and run IDs and show in the run detail view. Each run records its pinned `model` and `prompt_hash` (D-283).
- **Containers and trust zones (D-266, D-264, D-295):** the Builder executes in its own container with no host mounts other than its repo working copy, non-root, a scrubbed environment and a per-run GitHub token; until go-live the other agent runs execute on the host with an open network (D-300). Only the orchestrator holds the Supabase service key and connects to the database.
- **Run controls (D-233):** Retry creates a new queued run for the same project and stage with fresh attempts and keeps the old run as history. Cancel stops a run but keeps its working folder, branch and open pull request. A failed, stopped or parked run opens a detail view with the reason and timeline, the last log lines and the actions Resume, Rerun from scratch and End run. Resume starts a fresh run on the same branch from the last commit, built from the step journal (D-280), with the earlier log and notes as context; uncommitted work is lost because the working folder is reset at the start of every run (D-203). Rerun from scratch starts the stage again with no earlier context. End run closes the run without a new one.
- **Console commands (D-249, go-live, G16):** until then Cancel sets `cancel_requested` on the run and Retry creates a new queued run (D-301). At go-live Retry, Cancel, Resume and Run retention now reach the worker through a commands table that the console writes and the worker polls together with the queue. Commands wait while the laptop is off and run when the worker starts.
- Run logs are text rows in the database and are deleted 90 days after project close.

## Client accounts (D-094)

(Go-live, G15.) The owner enters the client's email; the client receives an invite email with a link to set a password. A project can have several client logins, with one named signer per project whose approval counts at client gates (D-238). Public sign-ups are off and client passwords have a minimum length of 12. Invite links last as long as Supabase allows for its own links, and the console can resend them (D-242).

## Phase 2 gate evidence (D-093, D-244)

Phase 2 has two parts with a gate each: part 2a, "a test client's intake runs through the real stage runner and intake agent to an accepted intake", and part 2b, "a test client signs off a PRD". Each is shown by three things recorded in `docs/plan/PROGRESS.md`: a manual walkthrough with the owner as the test client from a second email, an automated end-to-end test with stubbed model responses, and a cost report copied from `stage_runs` and compared with the estimates in `13-cost.md`. Part 2a also shows the walking skeleton (D-290).
## Previews, screenshots and QC (D-114 to D-117)

Vercel previews stay behind Vercel's login and only the owner views them. The worker builds the site and serves it locally; screenshots (full-page desktop and mobile), Lighthouse and Playwright all run against that build. No live preview is shared with the client before go-live. The client sees prototype screenshots, and new final screenshots after QC.

## Provisioning script (D-060, D-123)

An owner-run command that creates the client repo from `templates/master-starter`, installs the GitHub App, creates and links the Vercel project, and records the IDs. Each step checks whether it is already done, so a rerun resumes; a cleanup command removes a half-created project after a confirmation; a dry-run mode shows the planned steps first.

## Handover repo (D-137, D-139)

The client creates an empty GitHub repo and adds the owner. An owner-run script first refuses to run while an accepted change request is undeployed, then sets the change-request freeze (D-230), then pushes one clean commit to it, with no round history, pull requests or `.pipeline/` notes. The original repo and its pull requests stay with the owner.

## Phase 3 and 4 gate evidence (D-127, D-141)

Phase 3: the phase 2 evidence (manual walkthrough, automated end-to-end test with stubbed model responses, cost report) plus the Planner eval results on the 3 fictional fixtures. Phase 4: two real rounds on the dental fixture with a throwaway repo, exercising a re-plan, Feedback loops, a risky-command pause and an ask-client answer; an automated round-loop test with stubbed model and GitHub calls; table-driven tests of the command allowlist (allowed, refused and paused commands, including attempts to reword a refused one); and a cost report in tokens.
## Owner machine and services (D-196 to D-204)

- The worker runs inside WSL2 on the owner's Windows laptop, started by hand in a terminal for now; it keeps the laptop awake only while a run is active.
- Worker secrets live in a gitignored `.env` file and rely on full-disk encryption; one Anthropic key serves all projects.
- Development and tests use a local Supabase through the Supabase CLI and Docker; the database checks run on it under WSL2 Docker. Hosting (a hosted project on Pro, the free-plan pause rule and keep-alive of D-243) is deferred to go-live (D-263).
- Clients reach the dashboard at the default `vercel.app` address, also after the pilot (D-245). The owner's Vercel account moves to a paid plan from the first real client.
- A project's working folder is kept until the project closes and is reset at the start of every run. A model call that is rate-limited or overloaded waits with backoff and resumes without using an attempt; each backoff retry counts as a sign of life for the watchdog.

## Retention job (D-169, D-214)

(Go-live, G17; there is no retention job in the dev-only baseline, D-303.) The job runs at every worker start, so a missed date is caught up, on a schedule, and from a "Run retention now" button in the console, which also shows an overdue badge. It deletes uploads, intake data, run logs and the handover guide's contents and PDF when a project's retention date arrives, without a confirmation step, and records `data_deleted_at`. The worker removes the storage files first, then calls `erase_project_data()` for the database rows; approvals, the other artifacts and the project row are kept. The retention date is set by the function that closes or cancels a project. The job does not remove client accounts. A client's request for earlier deletion is handled by hand outside the pipeline.

## Change requests after go-live (D-174, D-175, D-193)

An accepted change request runs as a mini-round (`cr-N` branch, pull request into `staging`, owner Accept, then a hard-gate deploy step that merges `staging` into `main`) with the round checks only, plus Lighthouse on the pages the request touches (D-285). The dashboard shows each request's status; no email is sent to the client. Requests are accepted until the transfer script sets the freeze.

## Phase 5 gate evidence (D-171)

The pilot report against the pilot measures above, a cost report in tokens, and automated tests of the QC runner, the fix loop and a dry run of the handover script.
## Database checks (D-225)

`supabase/tests/run.sh` builds a scratch Postgres database from the migration and runs the row-level security and schema checks, including paused, closed and wrong-stage cases. CI runs it from Phase 1 (D-287); task P1-T08 moves it onto a local Supabase and extends it, and the mutation script (P1-T13) proves each rule by breaking it (D-288).

## Gate functions, migrations and review (D-239, D-240)

Gate rules live in the database: a function returns a project's remaining gates, which the console calls, and `accept_gate` records the approval, marks the artifact approved and advances in one transaction. Until real client data exists migrations are not frozen: they may be edited in place within a phase and are squashed into a fresh baseline at each phase gate, each change in its own PR with the owner's approval and an independent review (D-289). Once real data exists an applied migration is frozen and every later change is a new numbered, forward-only migration with no down script (D-240). Every database or access rule is proved by a mutation check: break the rule, watch a check fail, restore it. `pnpm doctor` checks that the env files are present, the migrations are applied and public sign-ups are off.

## Dependencies and supply chain (D-286)

Builds use a frozen lockfile and each round summary shows the lockfile diff. Install scripts run for all packages, only inside the run's container. A package that is not in the plan and not on a curated allowlist is flagged and needs the owner's approval. Dependabot or Renovate opens weekly update pull requests on the master starter.

## The Claude Doc (D-236)

The Claude Doc has been retired and deleted. The repo is the only source of the spec.
