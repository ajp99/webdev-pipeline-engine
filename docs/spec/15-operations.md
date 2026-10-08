# Operations

> Originally a snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05). The repo is the source of truth; this file includes the owner-approved decisions D-038 to D-069 recorded in `DECISIONS.md`. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

This file collects the decisions made after the original spec snapshot that are about running the pipeline rather than the pipeline's stages. Decision IDs refer to `DECISIONS.md`.

## Project setup and access (D-059, D-060)

- An **owner-run provisioning script** sets up each project: creates the client repo from `templates/master-starter`, installs the GitHub App on that repo, creates and links the Vercel project (production branch `main`, previews from `staging`), and records `github_repo` and `vercel_project_id` in `projects`.
- Workers get a **GitHub App** token: short-lived and limited to one client repository, created per run. Workers hold **no Vercel token**; Vercel deploys through its Git integration and previews are read from the GitHub deployment status.
- The owner sets production environment variables and domains in Vercel at deployment preparation, from an agent-written checklist.

## Notifications and mail (D-045, D-156, D-167, D-168, D-200)

Clients receive emails for four events: intake follow-ups ready, PRD ready, prototype ready, and an ask-client question waiting. The pipeline sends them over SMTP from the owner's Gmail account with an app password, and Supabase's invite and password-reset emails use the same Gmail through Supabase's custom SMTP. The owner is emailed when a gate is ready, when a run is waiting on a pause request, and when a run fails; overdue gates stay a console badge only. Change-request status and final screenshots send no email. Resend is not used unless a PRD names it.

## Backups (D-049, D-062, D-069)

The database is exported on a schedule and before each project close. Exports are encrypted, saved locally, and copied to the owner's own cloud drive. They never go into this repo. The key is kept in a password manager. There is no restore drill (accepted risk).

## Agent evals (D-065, D-067, D-068)

An automated eval harness with a judge model (Opus 5.5) runs fictional client fixtures stored in `evals/`. It runs when prompts or models change, not on every commit, and its scores are calibrated against the owner's spot checks. The Planner (skill selection and round plan) is evaluated first. Fixtures contain no real client data because the repo is public.

## Pilot (D-064)

The pilot is the owner's own site, with the owner playing the client from a second email account. It runs up to deployment on the Vercel address and then a handover to a second GitHub account; there is no custom domain, so the DNS steps are first exercised on a real client (D-172). Measures: token cost per project against the estimate in `13-cost.md`, owner time per stage, Feedback loops per gate, first-try Lighthouse pass, and defects found after go-live.

## Repo hygiene and CI (D-046)

GitHub secret scanning and push protection are on. CI and branch protection are deferred; until they exist, an agent's report that tests pass is unverified.

## MCP server (D-055, D-057, D-177)

A read-only MCP server would let the owner ask Claude about status, the approval queue, the backlog, and cost. It cannot approve, answer, or change anything, because a prompt-injected client message must never be able to approve a gate through chat. The owner is not sure it is needed, so it stays optional and is decided after the pilot (task P5-T08 is deferred until then).
## Runner behavior (D-081 to D-085)

- At most one ticket per project at a time, and at most 2 projects in parallel (adjustable with `WORKER_MAX_PARALLEL_PROJECTS`).
- A failed run is retried once automatically (at most 2 attempts), then fails to the owner's queue.
- No time limit on runs; the heartbeat and the token progress bar are the only guards. A run waiting for the owner's answer to a pause request keeps its slot.
- Run logs are text rows in the database and are deleted 90 days after project close.

## Client accounts (D-094)

The owner enters the client's email; the client receives an invite email with a link to set a password. A project can have several client logins.

## Phase 2 gate evidence (D-093)

"A test client signs off a PRD" is shown by three things recorded in `docs/plan/PROGRESS.md`: a manual walkthrough with the owner as the test client from a second email, an automated end-to-end test with stubbed model responses, and a cost report copied from `stage_runs` and compared with the estimates in `13-cost.md`.
## Previews, screenshots and QC (D-114 to D-117)

Vercel previews stay behind Vercel's login and only the owner views them. The worker builds the site and serves it locally; screenshots (full-page desktop and mobile), Lighthouse and Playwright all run against that build. No live preview is shared with the client before go-live. The client sees prototype screenshots, and new final screenshots after QC.

## Provisioning script (D-060, D-123)

An owner-run command that creates the client repo from `templates/master-starter`, installs the GitHub App, creates and links the Vercel project, and records the IDs. Each step checks whether it is already done, so a rerun resumes; a cleanup command removes a half-created project after a confirmation; a dry-run mode shows the planned steps first.

## Handover repo (D-137, D-139)

The client creates an empty GitHub repo and adds the owner. An owner-run script pushes one clean commit to it, with no round history, pull requests or `.pipeline/` notes. The original repo and its pull requests stay with the owner.

## Phase 3 and 4 gate evidence (D-127, D-141)

Phase 3: the phase 2 evidence (manual walkthrough, automated end-to-end test with stubbed model responses, cost report) plus the Planner eval results on the 3 fictional fixtures. Phase 4: two real rounds on the dental fixture with a throwaway repo, exercising a re-plan, Feedback loops, a risky-command pause and an ask-client answer; an automated round-loop test with stubbed model and GitHub calls; table-driven tests of the command allowlist (allowed, refused and paused commands, including attempts to reword a refused one); and a cost report in tokens.
## Owner machine and services (D-196 to D-204)

- The worker runs inside WSL2 on the owner's Windows laptop, started by hand in a terminal for now; it keeps the laptop awake only while a run is active.
- Worker secrets live in a gitignored `.env` file and rely on full-disk encryption; one Anthropic key serves all projects.
- Supabase is on the free plan until the pilot and on Pro before a real client uses the pipeline. Development and tests use a local Supabase through the Supabase CLI and Docker.
- Clients reach the dashboard at the default `vercel.app` address.
- A project's working folder is kept until the project closes and is reset at the start of every run. A model call that is rate-limited or overloaded waits with backoff and resumes without using an attempt.

## Retention job (D-169, D-214)

A scheduled worker job deletes uploads, intake data and run logs when a project's retention date arrives, without a confirmation step, and records `data_deleted_at`. It does not remove client accounts. A client's request for earlier deletion is handled by hand outside the pipeline.

## Change requests after go-live (D-174, D-175, D-193)

An accepted change request runs as a mini-round (`cr-N` branch, pull request into `staging`, owner Accept, then a hard-gate deploy step that merges `staging` into `main`) with the round checks only. The dashboard shows each request's status; no email is sent.

## Phase 5 gate evidence (D-171)

The pilot report against the pilot measures above, a cost report in tokens, and automated tests of the QC runner, the fix loop and a dry run of the handover script.
