# Operations

> Originally a snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05). The repo is the source of truth; this file includes the owner-approved decisions D-038 to D-069 recorded in `DECISIONS.md`. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

This file collects the decisions made after the original spec snapshot that are about running the pipeline rather than the pipeline's stages. Decision IDs refer to `DECISIONS.md`.

## Project setup and access (D-059, D-060)

- An **owner-run provisioning script** sets up each project: creates the client repo from `templates/master-starter`, installs the GitHub App on that repo, creates and links the Vercel project (production branch `main`, previews from `staging`), and records `github_repo` and `vercel_project_id` in `projects`.
- Workers get a **GitHub App** token: short-lived and limited to one client repository, created per run. Workers hold **no Vercel token**; Vercel deploys through its Git integration and previews are read from the GitHub deployment status.
- The owner sets production environment variables and domains in Vercel at deployment preparation, from an agent-written checklist.

## Client notifications (D-045)

Clients receive emails via Resend for four events: intake follow-ups ready, PRD ready, prototype ready, and an ask-client question waiting. The pipeline has its own Resend sender (the owner supplies the domain and DNS records). Owner alerts stay dashboard-only.

## Backups (D-049, D-062, D-069)

The database is exported on a schedule and before each project close. Exports are encrypted, saved locally, and copied to the owner's own cloud drive. They never go into this repo. The key is kept in a password manager. There is no restore drill (accepted risk).

## Agent evals (D-065, D-067, D-068)

An automated eval harness with a judge model (Opus 5.5) runs fictional client fixtures stored in `evals/`. It runs when prompts or models change, not on every commit, and its scores are calibrated against the owner's spot checks. The Planner (skill selection and round plan) is evaluated first. Fixtures contain no real client data because the repo is public.

## Pilot (D-064)

The pilot is the owner's own site, with the owner playing the client from a second email account. Measures: token cost per project against the estimate in `13-cost.md`, owner time per stage, Feedback loops per gate, first-try Lighthouse pass, and defects found after go-live.

## Repo hygiene and CI (D-046)

GitHub secret scanning and push protection are on. CI and branch protection are deferred; until they exist, an agent's report that tests pass is unverified.

## MCP server (D-055, D-057)

A read-only MCP server lets the owner ask Claude about status, the approval queue, the backlog, and cost. It cannot approve, answer, or change anything, because a prompt-injected client message must never be able to approve a gate through chat. It lands at the end of phase 5, before the pilot.
## Runner behavior (D-081 to D-085)

- At most one ticket per project at a time, and at most 2 projects in parallel (adjustable with `WORKER_MAX_PARALLEL_PROJECTS`).
- A failed run is retried once automatically (at most 2 attempts), then fails to the owner's queue.
- No time limit on runs; the heartbeat and the cost warning are the only guards.
- Run logs are text rows in the database and are deleted 90 days after project close.

## Client accounts (D-094)

The owner enters the client's email; the client receives an invite email with a link to set a password. A project can have several client logins.

## Phase 2 gate evidence (D-093)

"A test client signs off a PRD" is shown by three things recorded in `docs/plan/PROGRESS.md`: a manual walkthrough with the owner as the test client from a second email, an automated end-to-end test with stubbed model responses, and a cost report copied from `stage_runs` and compared with the estimates in `13-cost.md`.
