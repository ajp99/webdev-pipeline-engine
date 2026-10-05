# Phase 1: Foundation

**Status:** not started

**Goal:** Database, authentication, tooling, and an owner console shell, with the approval and stage-advance rules enforced in the database.

**Gate (owner accepts this phase when):** An approved dummy artifact moves a project stage.

**Spec to read:** [10-data-model.md](../spec/10-data-model.md), [12-security.md](../spec/12-security.md), [03-pipeline-and-gates.md](../spec/03-pipeline-and-gates.md), [11-owner-console-and-client-dashboard.md](../spec/11-owner-console-and-client-dashboard.md)

Rules: work only on this phase's tasks; tick each box when its acceptance criteria are met and add an entry to [PROGRESS.md](PROGRESS.md). Ask the owner before schema changes or dependencies not named in a task. Spec files are read-only; propose changes in `docs/proposals/`.

## Tasks

- [ ] **P1-T01 Set up tooling and workspaces**  
  Acceptance: Approved dependencies: next, react, react-dom, typescript, tailwindcss, eslint, prettier, vitest, yaml, @supabase/supabase-js, @supabase/ssr. `pnpm install` produces a lockfile; `pnpm --filter @wpe/web dev` serves a page; `pnpm -r typecheck`, `pnpm lint` and `pnpm test` run and pass; the Commands section of `AGENTS.md` lists them.

- [ ] **P1-T02 Create the Supabase project and apply the migration**  
  Acceptance: The owner supplies the project URL and keys; the agent never asks for them in chat or commits them. Review the items marked PROPOSAL in `0001_init.sql` with the owner (see `docs/proposals/`). Migration applies to a fresh database; 16 tables and 9 gate defaults exist.

- [ ] **P1-T03 Generate database types into packages/shared**  
  Acceptance: Types generated from the live schema live in `packages/shared`; a documented script regenerates them; `pnpm -r typecheck` passes.

- [ ] **P1-T04 Load stage and gate definitions in packages/shared**  
  Acceptance: `stages.yaml` and `gates.yaml` are parsed and validated into typed constants. A test checks that the `gate_config` seed rows match `gates.yaml`.

- [ ] **P1-T05 Authentication and roles**  
  Acceptance: Owner login (email + password) with the owner role set in `app_metadata` by a service-role script; client login. Unauthenticated users are redirected; a client cannot reach owner routes.

- [ ] **P1-T06 Owner console shell**  
  Acceptance: Project list and approval queue pages. Each pending gate shows its type (soft, hard, client), the Accept, Feedback and Reject actions, and an overdue badge computed from `escalate_after_hours`.

- [ ] **P1-T07 Implement advance_stage()**  
  Acceptance: Add migration `0002` that replaces the stub function (the owner approves this schema change first; never edit an applied migration). Checks that every gate for the current stage has its approval record (project override first, then global default), that the next stage follows `stages.yaml`, that paused projects cannot advance, and that nothing advances without an approval. SQL tests cover each rule, including the two-step prototype gate and the client-only PRD gate.

- [ ] **P1-T08 Automated RLS tests**  
  Acceptance: Tests in `supabase/tests/` reproduce these checks: a client sees only their own project's visible rows; cannot see rounds, gate config or other projects; cannot forge owner approvals; cannot change `stage`; can answer only `client_answer` on ask-client items; can comment only during the prototype stage; approvals are append-only; anon reads nothing.

- [ ] **P1-T09 Gate demonstration**  
  Acceptance: Seed script creates a dummy project and artifact. The owner clicks Accept in the console, an approval record is written, `advance_stage()` runs, and the stage changes in the UI. Record the run in `PROGRESS.md`.

## Gate

The phase is done when: **An approved dummy artifact moves a project stage**. Only the owner marks it done, by setting **Status** above to `done` and updating `docs/plan/README.md`.
