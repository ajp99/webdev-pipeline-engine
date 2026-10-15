# AGENTS.md

Instructions for AI coding agents working in this repository. Claude Code reads `CLAUDE.md`, which points here.

## What this project is

CreatePipeline Engine is a single-owner internal system that takes marketing-site clients from intake to handover. Agents do the work; the owner approves every step. This repo contains the spec, the plan, and the code for the tool itself (not the client sites it builds). Until go-live the project is dev-only (D-263): a local Supabase and no real clients; deferred items are in `docs/plan/go-live-readiness.md`.

## Read first, in this order

1. `docs/spec/README.md`, then the spec files relevant to your task (`docs/spec/00-overview.md` has every locked decision).
2. `docs/plan/README.md` to find the current phase, then that phase's file in `docs/plan/`.
3. `DECISIONS.md` for why things were chosen.
4. `supabase/migrations/` for the data model; `docs/spec/stages.yaml` and `docs/spec/gates.yaml` for stages and gates; `docs/spec/15-operations.md` for setup, backups, evals and the pilot.

## Rules

1. **One phase at a time.** Work only on tasks from the current phase: the first phase in `docs/plan/README.md` whose status is not `done` (Phase 2 has parts 2a and 2b, each with its own gate). Do not start the next phase until the owner has accepted the current phase's gate and marked it done.
2. **Spec files change only with the owner's approval.** Never edit anything under `docs/spec/` on your own. If the spec is wrong, unclear, or silent on something you need, write a proposal in `docs/proposals/` (copy `TEMPLATE.md`) and stop on that point for the owner to decide. Do not guess. Once the owner has approved a specific proposal (in chat, or by filling in its "Owner decision" section), you may make exactly those edits to the spec files, in their own PR containing only spec changes, and mark the proposal `accepted`. Nothing beyond the approved text, and no spec edit without an approval you can point to; if in doubt, ask.
3. **Track your work.** After finishing each task, tick its checkbox in the phase file and append an entry to `docs/plan/PROGRESS.md` (format at the top of that file).
4. **Ask before schema or dependency changes.** Ask the owner before changing the database schema (anything in `supabase/migrations/`) or adding an application dependency. Dependencies explicitly named in a task are already approved for that task, and standard dev tooling (linters, formatters, test runners, type packages) may be added without asking. Until real client data exists, migrations are not frozen: they may be edited in place within a phase and are squashed into a fresh baseline at each phase gate (D-289); once real data exists an applied migration is frozen and later changes are new numbered, forward-only migrations (D-240). Every migration change goes in its own PR.
5. **Prove every database or access rule by breaking it.** For each new or changed rule (policy, trigger, function), make a deliberate break and show that at least one check fails, then restore it. Record this in `PROGRESS.md`.
6. **Proposals and reviews.** At the start and at the end of each phase, ask the owner whether to apply the open proposals in `docs/proposals/` and offer a ready-to-apply patch. Before each phase gate and before each migration PR, an independent review by a fresh reviewer who has not seen the build is required.
7. **PRs and progress entries.** Open one PR per cluster of 2 to 4 related tasks. Keep `PROGRESS.md` entries short: what changed, evidence, open items; put the detail in the PR description.

## Security rules

- This repo is public. Never commit secrets, keys, tokens, client data, or real credentials. Only `.env.example` files are committed.
- `apps/web` must never hold worker secrets (Claude API key, Supabase service role key, GitHub or Vercel tokens). Those belong to `apps/worker` only.
- Workers use only short-lived GitHub App tokens limited to one repository. Never request, store, or use a Vercel token. Database exports and backups (`backups/`, `*.dump`) never go in the repo.
- Never write `projects.stage` directly. Stage changes go through `advance_stage()`; nothing advances without an approval record. No auto-advance anywhere.
- Commit messages and pull request text carry no AI attribution: no `Co-Authored-By` naming an AI, no session links, no "generated with" lines. The owner is the only author. After cloning, run `git config core.hooksPath .githooks` (the hook removes such trailers).
- The Supabase MCP server in `.mcp.json` points at the local stack and is read-only (D-274). Use it for reads and documentation only. Any write through it (data, schema, functions, storage, branches, migrations) needs the owner's approval first, and schema changes also follow rule 4.
- Only the orchestrator holds the Supabase service key and connects to the database; agent runs hold no Supabase or database credentials (D-264, D-295). Gate functions are callable only from an owner session.
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
| `docs/spec` | Locked spec (edited only after the owner approves a proposal), plus `stages.yaml` and `gates.yaml` |
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
- Mutation check: `bash supabase/tests/mutations.sh` (about 2 minutes). Run it after any change to `supabase/`; add a file to `supabase/tests/mutations/` for each new or changed rule.
- Install: `pnpm install` (Node 22 or newer, `.nvmrc`).
- Dev server: `pnpm dev` (runs `@wpe/web`).
- Checks: `pnpm lint`, `pnpm typecheck` (all workspaces), `pnpm test` (all workspaces), `pnpm format:check`.
- Docs lint: `pnpm docs:lint` (placeholders, decision-ID continuity, broken links); `pnpm docs:lint:test` tests the linter.
- Formatting: `pnpm format` skips `docs/`, `supabase/` and the markdown files on purpose (see `.prettierignore`); spec files are hand-formatted.
