# Phase 1: Foundation

**Status:** not started

**Goal:** Database, authentication, tooling, and an owner console shell, with the approval and stage-advance rules enforced in the database.

**Gate (owner accepts this phase when):** An approved dummy artifact moves a project stage.

**Spec to read:** [10-data-model.md](../spec/10-data-model.md), [12-security.md](../spec/12-security.md), [03-pipeline-and-gates.md](../spec/03-pipeline-and-gates.md), [11-owner-console-and-client-dashboard.md](../spec/11-owner-console-and-client-dashboard.md)

Rules: work only on this phase's tasks; tick each box when its acceptance criteria are met and add an entry to [PROGRESS.md](PROGRESS.md). Ask the owner before schema changes or dependencies not named in a task. Spec files are read-only; propose changes in `docs/proposals/`.

## Tasks

- [ ] **P1-T01 Set up tooling and workspaces**  
  Acceptance: Node 22 or newer (`.nvmrc`). Approved dependencies: next, react, react-dom, typescript, tailwindcss, eslint, prettier, vitest, yaml, @supabase/supabase-js, @supabase/ssr; standard dev tooling may be added without asking. `pnpm install` produces a lockfile; `pnpm --filter @wpe/web dev` serves a page; `pnpm -r typecheck`, `pnpm lint` and `pnpm test` run and pass; the Commands section of `AGENTS.md` lists them.

- [ ] **P1-T02 Create the Supabase project and apply the migration**  
  Acceptance: The owner supplies the project URL and keys; the agent never asks for them in chat or commits them. Migration `0001_init.sql` applies to a fresh database: 21 tables, 9 gate defaults, the status enums, the `owners` table and the queue columns on `stage_runs`. The owner's row in `owners` is inserted with the service role (task P1-T05 provides the script). The owner reviews the schema once more before it is applied.

- [ ] **P1-T03 Generate database types into packages/shared**  
  Acceptance: Types generated from the live schema live in `packages/shared`; a documented script regenerates them; `pnpm -r typecheck` passes.

- [ ] **P1-T04 Stage and gate consistency test**  
  Acceptance: A test parses `stages.yaml` and `gates.yaml` and fails if the SQL `stage` enum or the `gate_config` seed rows disagree with them. TypeScript types come from the generated database types (P1-T03); the console and `advance_stage()` read gate behavior from `gate_config`. No code generator.

- [ ] **P1-T05 Authentication and roles**  
  Acceptance: Owner login (email + password); the owner's row in `owners` is inserted by a service-role bootstrap script; client login. Unauthenticated users are redirected; a client cannot reach owner routes.

- [ ] **P1-T06 Owner console shell**  
  Acceptance: Project list and approval queue pages. Each pending gate shows its type (soft, hard, client), the Accept, Feedback and Reject actions, and an overdue badge computed from `escalate_after_hours`.

- [ ] **P1-T07 Implement advance_stage()**  
  Acceptance: Add migration `0002` that replaces the stub function (the owner approves this schema change first; never edit an applied migration). Checks that every gate for the current stage has its approval record (project override first, then global default), that the next stage follows `stages.yaml`, that paused projects cannot advance, and that nothing advances without an approval. SQL tests cover each rule, including the two-step prototype gate and the client-only PRD gate.

- [ ] **P1-T08 Automated RLS tests**  
  Acceptance: Tests in `supabase/tests/` cover: a client sees only their own project's visible rows and their own project's template snapshot; a client cannot read `intake_templates`, `owners`, rounds, gate config or other projects; cannot forge owner approvals; cannot become an owner; cannot change `stage`; can answer only `client_answer` on ask-client items; can comment only during the prototype stage and cannot set `owner_disposition`; approvals are append-only; anon reads nothing; the queue claim with `FOR UPDATE SKIP LOCKED` works for the service role; clients write intake answers only while a round is open and can submit or reopen but never review a round; uploads reject zip, macro-enabled documents and files over 25 MB, and clients cannot mark an upload clean; clients cannot read `owner_notes` or `run_logs`; clients can add PRD feedback only on a client-visible PRD during the requirements stage; clients can submit change requests only in the handover stage and cannot set the impact note or decision; `attempts` above 2 is rejected.

- [ ] **P1-T09 Gate demonstration**  
  Acceptance: Seed script creates a dummy project and artifact. The owner clicks Accept in the console, an approval record is written, `advance_stage()` runs, and the stage changes in the UI. Record the run in `PROGRESS.md`.

- [ ] **P1-T10 Encrypted backup script**  
  Acceptance: A script exports the database, encrypts it (the key stays in the owner's password manager, never in the repo), saves it locally and copies it to the owner's cloud drive. It runs on a schedule and on demand (for the final export before a project close). `.gitignore` excludes exports. There is no restore drill (accepted risk D-069).

- [ ] **P1-T11 Confirm secret scanning and push protection**  
  Acceptance: The owner confirms in the GitHub repository settings that secret scanning and push protection are enabled; record the confirmation in `PROGRESS.md`.

## Gate

The phase is done when: **An approved dummy artifact moves a project stage**. Only the owner marks it done, by setting **Status** above to `done` and updating `docs/plan/README.md`.
