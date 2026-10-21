# Phase 1: Foundation

**Status:** in progress

**Goal:** Database, authentication, tooling, and an owner console shell, with the approval and stage-advance rules enforced in the database.

**Gate (owner accepts this phase when) (D-297):** The migrations are applied to a real local Supabase, the database checks pass there (P1-T02, P1-T08) and an approved dummy artifact moves a project stage (P1-T09). P1-T05 and P1-T06 become the first tasks of Phase 2a; P1-T10 and P1-T15 move to go-live (G6). P1-T11 and P1-T16 are owner actions that do not block the gate. P1-T17 closes with the independent review of the squashed baseline.

**Spec to read:** [10-data-model.md](../spec/10-data-model.md), [12-security.md](../spec/12-security.md), [03-pipeline-and-gates.md](../spec/03-pipeline-and-gates.md), [11-owner-console-and-client-dashboard.md](../spec/11-owner-console-and-client-dashboard.md)

Rules: work only on this phase's tasks; tick each box when its acceptance criteria are met and add an entry to [PROGRESS.md](PROGRESS.md). Ask the owner before schema changes or dependencies not named in a task. Spec files change only with the owner's approval; propose changes in `docs/proposals/`.

## Tasks

- [x] **P1-T01 Set up tooling and workspaces**  
  Acceptance: Node 22 or newer (`.nvmrc`). Approved dependencies: next, react, react-dom, typescript, tailwindcss, eslint, prettier, vitest, yaml, @supabase/supabase-js, @supabase/ssr; standard dev tooling may be added without asking. `pnpm install` produces a lockfile; `pnpm --filter @wpe/web dev` serves a page; `pnpm -r typecheck`, `pnpm lint` and `pnpm test` run and pass; the Commands section of `AGENTS.md` lists them. The worker is developed and run inside WSL2 on Windows; a local Supabase runs through the Supabase CLI and Docker for development and tests; worker secrets live in a gitignored `.env` file (only `.env.example` is committed).

- [x] **P1-T02 Start the local Supabase and apply the migrations**  
  Acceptance: Development is dev-only (D-263): there is no hosted project. `supabase init` and `supabase start` (Supabase CLI and Docker, in WSL2) run a local stack; the local URL and keys go in gitignored env files and never into chat or the repo. The migrations apply to a fresh local database with the tables in `docs/spec/10-data-model.md`, the gate defaults, the status enums, the `owners` table and the queue columns on `stage_runs`. The owner's row in `owners` is inserted with the service role (task P1-T05 provides the script). The owner reads the schema once more before the phase gate. Hosting is on `docs/plan/go-live-readiness.md` (G1).

- [x] **P1-T03 Generate database types into packages/shared**  
  Acceptance: Types generated from the live schema live in `packages/shared`; a documented script regenerates them; `pnpm -r typecheck` passes.

- [x] **P1-T04 Stage and gate consistency test**  
  Acceptance: A test parses `stages.yaml` and `gates.yaml` and fails if the SQL `stage` enum or the `gate_config` seed rows disagree with them. TypeScript types come from the generated database types (P1-T03); the console and `advance_stage()` read gate behavior from `gate_config`. No code generator.

- [ ] **P1-T05 Authentication and roles (moves to 2a, owner login only, D-298)**  
  Acceptance: Owner login (email + password); the owner's row in `owners` is inserted by a service-role bootstrap script. Unauthenticated users are redirected. There is no client login until go-live (G15).

- [ ] **P1-T06 Owner console shell (moves to 2a, D-297)**  
  Acceptance: Project list and approval queue pages. Each pending gate shows its type (soft, hard, client), the Accept, Feedback and Reject actions, and an overdue badge computed from `escalate_after_hours`.

- [x] **P1-T07 Implement advance_stage()**  
  Acceptance: Add migration `0002` (squashed into `0001_init.sql`, D-308) that replaces the stub function (the owner approves this schema change first; never edit an applied migration). Checks that every gate for the current stage has its approval record (project override first, then global default), that the next stage follows `stages.yaml`, that paused projects cannot advance, and that nothing advances without an approval. Only approvals on the stage's own output artifacts count, so a release-note approval after go-live (D-223) can never advance a stage. The final step from handover also sets `projects.status` to `closed` and `close_reason` to `completed` in the same call (D-220). SQL tests cover each rule, including the two-step prototype gate and the client-only PRD gate.

- [x] **P1-T08 Automated RLS tests**  
  Acceptance: Tests in `supabase/tests/` cover: a client sees only their own project's visible rows and their own project's template snapshot; a client cannot read `intake_templates`, `owners`, rounds, gate config or other projects; cannot forge owner approvals; cannot become an owner; cannot change `stage`; can answer only `client_answer` on ask-client items; can comment only during the prototype stage and cannot set `owner_disposition`; approvals are append-only; anon reads nothing; the queue claim with `FOR UPDATE SKIP LOCKED` works for the service role; clients write intake answers only while a round is open and can submit or reopen but never review a round; uploads reject zip, macro-enabled documents and files over 25 MB, and clients cannot mark an upload clean; clients cannot read `owner_notes` or `run_logs`; clients can add PRD feedback only on a client-visible PRD during the requirements stage; clients can submit change requests only in the handover stage and cannot set the impact note or decision; `attempts` above 2 is rejected; clients can leave final-screenshot notes only during the deploy_prep stage and prototype notes only during the prototype stage; clients cannot read `run_approvals` or the rounds' claims and cannot change `answer_action`; `feedback_count` above 3 is rejected; a run can move to `waiting`. The committed suite (`bash supabase/tests/run.sh`, D-225) is the starting point: move it onto a local Supabase (Supabase CLI and Docker) and extend it. It already covers the paused, closed and wrong-stage cases of D-216 to D-218 and the email log. The checks also cover the rules of D-265, D-269, D-270, D-271, D-272 and D-278, each proved by the mutation script of P1-T13.

- [x] **P1-T09 Gate demonstration**  
  Acceptance: Seed script creates a dummy project and artifact. The owner clicks Accept in the console, an approval record is written, `advance_stage()` runs, and the stage changes in the UI. Record the run in `PROGRESS.md`.

- [-] **P1-T10 Encrypted backup script (moved to go-live, G6)**  
  Acceptance: A script exports the database, encrypts it (the key stays in the owner's password manager, never in the repo), saves it locally and copies it to the owner's cloud drive. It runs on a schedule and on demand (for the final export before a project close), and deletes exports older than 180 days (D-222). `.gitignore` excludes exports. It points at the local database; one restore of an export into a scratch database is proved in P1-T15 (D-294). A regular restore drill is not scheduled (D-069).

- [x] **P1-T11 Confirm secret scanning and push protection**  
  Acceptance: The owner confirms in the GitHub repository settings that secret scanning and push protection are enabled; record the confirmation in `PROGRESS.md`. Do this now, before further work, and revoke the old personal access token (D-292).

- [x] **P1-T12 CI workflow and CODEOWNERS**  
  Acceptance (D-287): `.github/workflows/ci.yml` runs on every pull request with no secrets: lint, typecheck, unit tests and format check; the database checks on a Postgres 16 service (`bash supabase/tests/run.sh`); and a job that starts the local Supabase stack and runs the same suites against it. `.github/CODEOWNERS` names the owner for `supabase/migrations/**`. Branch protection stays the owner's call.

- [x] **P1-T13 Mutation script**  
  Acceptance (D-288): `supabase/tests/mutations.sh` applies each listed deliberate break of a database rule to a scratch database, runs the suites and requires at least one check to fail for each break; a break that passes all checks fails the script. A workflow runs it on pull requests that touch `supabase/**` and on demand before each phase gate. `PROGRESS.md` records the number of breaks and the result.

- [x] **P1-T14 Docs lint**  
  Acceptance (D-291): `pnpm docs:lint` fails on placeholder text such as `(D-?)`, a gap or repeat in the decision IDs, and a broken relative link in the markdown files; CI runs it. Generated status and stage tables follow once the source of truth for phase status is chosen.

- [-] **P1-T15 Backup restore proof (moved to go-live, G6)**  
  Acceptance (D-294): `scripts/backup.sh` runs against the local database, and one encrypted export is restored into a scratch database and checked (row counts match). The result is recorded in `PROGRESS.md`.

- [x] **P1-T16 Local read-only MCP configuration**  
  Acceptance (D-274): `.mcp.json` points at the local Supabase stack with read-only access, not at a hosted project; `AGENTS.md` and `docs/spec/15-operations.md` describe it. The flag that makes the server read-only is checked against the tool's documentation and recorded.

- [x] **P1-T17 Migration hardening (own PR, independent review)**  
  Acceptance (D-271, D-265, D-269, D-270, D-272, D-278, D-281, D-283): `0001` and `0002` were edited in place and then squashed into one baseline `0001_init.sql` (D-308), and the squash pruned the mutation suite by rule (D-306, 87 files): helpers in a `private` schema and an empty `search_path` with qualified names for every security-definer function; `approvals.content_sha256` and `approved_by_email` written by the database; `advance_stage()` honours the effective gatekeeper and global `gate_config` rows are protected; `stage_runs.trace_id`, `model` and `prompt_hash`, `run_logs.trace_id`, and a partial unique index allowing one running, waiting or `cancel_requested` run per project (the intake-answer guard left with the client schema, D-298). The independent review of the merged squash found no serious issue; its gaps are go-live items G20 to G22. Each rule has checks and a mutation in `mutations.sh`; types are regenerated.

## Gate

The phase is done when: **An approved dummy artifact moves a project stage**. Only the owner marks it done, by setting **Status** above to `done` and updating `docs/plan/README.md`.
