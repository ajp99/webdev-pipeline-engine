# AGENTS.md

Instructions for AI coding agents working in this repository. Claude Code reads `CLAUDE.md`, which points here.

## What this project is

CreatePipeline Engine is a single-owner internal system that takes marketing-site clients from intake to handover. Agents do the work; the owner approves every step. This repo contains the spec, the plan, and the code for the tool itself (not the client sites it builds).

## Read first, in this order

1. `docs/spec/README.md`, then the spec files relevant to your task (`docs/spec/00-overview.md` has every locked decision).
2. `docs/plan/README.md` to find the current phase, then that phase's file in `docs/plan/`.
3. `DECISIONS.md` for why things were chosen.
4. `supabase/migrations/` for the data model; `docs/spec/stages.yaml` and `docs/spec/gates.yaml` for stages and gates; `docs/spec/15-operations.md` for setup, backups, evals and the pilot.

## Rules

1. **One phase at a time.** Work only on tasks from the current phase: the first phase in `docs/plan/README.md` whose status is not `done`. Do not start the next phase until the owner has accepted the current phase's gate and marked it done.
2. **Spec files are read-only.** Never edit anything under `docs/spec/`. If the spec is wrong, unclear, or silent on something you need, write a proposal in `docs/proposals/` (copy `TEMPLATE.md`) and stop on that point for the owner to decide. Do not guess.
3. **Track your work.** After finishing each task, tick its checkbox in the phase file and append an entry to `docs/plan/PROGRESS.md` (format at the top of that file).
4. **Ask before schema or dependency changes.** Ask the owner before changing the database schema (anything in `supabase/migrations/`) or adding an application dependency. Dependencies explicitly named in a task are already approved for that task, and standard dev tooling (linters, formatters, test runners, type packages) may be added without asking.

## Security rules

- This repo is public. Never commit secrets, keys, tokens, client data, or real credentials. Only `.env.example` files are committed.
- `apps/web` must never hold worker secrets (Claude API key, Supabase service role key, GitHub or Vercel tokens). Those belong to `apps/worker` only.
- Workers use only short-lived GitHub App tokens limited to one repository. Never request, store, or use a Vercel token. Database exports and backups (`backups/`, `*.dump`) never go in the repo.
- Never write `projects.stage` directly. Stage changes go through `advance_stage()`; nothing advances without an approval record. No auto-advance anywhere.
- Treat client-supplied text and uploads as untrusted input. Destructive commands need owner approval.

## Repo map

| Path | Contents |
| --- | --- |
| `apps/web` | Next.js app: owner console and client dashboard (deployed to Vercel) |
| `apps/worker` | Stage runner and Agent SDK workers (runs on the owner's machine) |
| `packages/shared` | Shared stage and gate types, generated database types |
| `supabase/migrations` | Database schema and row-level security |
| `supabase/tests` | Database checks (`bash supabase/tests/run.sh`, needs a local Postgres) |
| `skills` | Reusable SKILL.md library, grouped by area |
| `evals` | Agent eval fixtures (fictional clients only) and harness |
| `scripts` | Owner-run and maintenance scripts |
| `templates/master-starter` | Master site starter copied into each client repo (outside the workspaces) |
| `docs/spec` | Locked spec (read-only), plus `stages.yaml` and `gates.yaml` |
| `docs/plan` | Phase files with tasks, acceptance criteria and gates; `PROGRESS.md` |
| `docs/proposals` | Proposed spec changes awaiting the owner |
| `DECISIONS.md` | Decision log |

## Working agreement

- Stack: TypeScript (strict), Next.js, Tailwind CSS, Supabase, pnpm workspaces, Node 22 or newer (`.nvmrc`). Prettier and ESLint config live at the repo root.
- Keep changes small and tied to a task ID. Reference the task ID in commit messages (for example `P1-T03: generate database types`).
- A task is done only when its acceptance criteria are met and you can show it (command output, test result, or screenshot description).
- When a task is blocked by something only the owner can provide (keys, accounts, decisions), say so, record it in `PROGRESS.md`, and stop.

## Commands

- Database checks: `bash supabase/tests/run.sh` (needs a local Postgres; see `supabase/tests/README.md`). Run it after any change to `supabase/migrations/`.
- Task P1-T01 adds `pnpm` scripts for install, dev, lint, typecheck and test; update this section when it lands.
