# Progress log

Append one entry per finished task, newest at the bottom. Keep entries short (what changed, evidence, open items); detail goes in the PR description. Format:

```
## YYYY-MM-DD P1-T03 Short title
- What changed: ...
- Evidence: command output, test result, or link
- Follow-ups or blockers: ...
```

---

## 2026-10-08 P1-T01 Set up tooling and workspaces
- What changed: pnpm workspaces with Next.js 16, React 19, Tailwind 4, TypeScript 6.0 (pinned; typescript-eslint does not support 7 yet), ESLint 10, Prettier, Vitest 5, yaml, supabase-js and @supabase/ssr; a minimal web page, a worker stub and a shared stage list with one test; `.prettierignore` keeps docs and spec files untouched.
- Evidence: `pnpm lint` clean; `pnpm -r typecheck` clean in 3 workspaces; `pnpm test` 1 passed; `pnpm --filter @wpe/web build` succeeds; `pnpm dev` serves the page.
- Follow-ups or blockers: local Supabase through the Supabase CLI and Docker is set up in P1-T08; the worker runs in WSL2 on the owner's laptop.

## 2026-10-08 P1-T04 Stage and gate consistency test
- What changed: `packages/shared/src/consistency.test.ts` parses `stages.yaml` and `gates.yaml` and checks the SQL stage, status and close-reason enums, the `gate_config` seed rows and the TypeScript `STAGES` constant against them, plus that the release-note approval is not a stage gate (D-223).
- Evidence: 7 tests pass. Mutation check: reordering the SQL enum and changing a seed row made 2 tests fail; restored, all pass.
- Follow-ups or blockers: none. The generated database types (P1-T03) will add to the TypeScript side.

## 2026-10-08 P1-T07 Implement advance_stage()
- What changed: migration `0002_advance_stage.sql` replaces the stub (no table, column or policy changes; owner approved the schema change and the mapping). Rules: owner or service role only; project must be active; next stage must follow the enum order; the newest, non-superseded artifact of the stage's gating type needs an approval for every gate type in `gate_config` (global gates plus any the project adds; a project row never removes a global gate); in the prototype stage the client approval must come at or after an owner approval on the same version; build_rounds leaves only when every non-change-request round is approved and has a soft approval on its `round_summary` artifact (version = round number); handover to closed also sets status closed and reason completed (D-220); release-note approvals never count (D-223). `supabase/tests/advance_suite.sql` has 34 checks (more were added after the branch review, see below) and `run.sh` now loads every migration and every suite.
- Evidence: `bash supabase/tests/run.sh` PASS 157, FAIL 0, ERRORS 0 (the 34 new checks all failed against the stub first). Mutation check: 6 deliberate breaks of the function each made at least one check fail (one needed an extra test for superseded round summaries, added).
- Follow-ups or blockers: artifact types `intake_record`, `deployment_checklist` and `round_summary` are now required names, and the stages.yaml output names differ (a proposal is still to be filed to align them). `retention_until` is not set at close; task P5-T05 owns the retention date. Cancelling a project is not an advance and needs its own path (console, P1-T06).

## 2026-10-08 P1-T03 Generate database types into packages/shared
- What changed: `scripts/gen-types.sh` regenerates `packages/shared/src/database.types.ts` from any Postgres (`SUPABASE_DB_URL`, default the local Supabase); `@wpe/shared` exports `Database`, `Json` and `Constants`, and a compile-time check ties the hand-written `Stage` union to the generated enum. Two more tests check that the types declare all 23 tables and the same stages as `stages.yaml`.
- Evidence: `pnpm -r typecheck` clean, `pnpm lint` clean, `pnpm test` 9 passed. The file was generated from the scratch Postgres with migrations 0001 and 0002 applied, because this sandbox has no Docker or Supabase project.
- Follow-ups or blockers: regenerate against the real Supabase project once P1-T02 is done (`SUPABASE_DB_URL=... scripts/gen-types.sh`); output should be identical.

## 2026-10-08 P1-T08 Automated RLS tests (partly done, task stays open)
- What changed: `supabase/tests/access_suite.sql` adds 35 checks for anon, owners and templates, gate config, run logs, append-only approvals, macro-enabled and executable uploads, scan status, intake round review and the queue claim; `run.sh` loads every migration and three suites, and has a local Supabase mode (`WPE_SUPABASE_DB_URL`). The earlier 120 checks and the 34 `advance_stage()` checks are included.
- Evidence: `bash supabase/tests/run.sh` PASS 191, FAIL 0, ERRORS 0 on a scratch Postgres 16. Mutation check: dropping the append-only trigger made 4 checks fail.
- Follow-ups or blockers: the acceptance criteria also ask for the checks to run on a local Supabase (Supabase CLI and Docker). This sandbox has no Docker, so that mode is written but not run. Owner step: `supabase start`, `supabase db reset`, then the command in `supabase/tests/README.md`; report the result so the task can be ticked.

## 2026-10-08 P1-T05 Authentication and roles (code done, live check open)
- What changed: email and password sign-in (`/login`), sign-out, a Next.js proxy that refreshes the Supabase session and sends visitors to the area their role allows, second checks in the owner and client layouts, pure routing rules in `apps/web/src/lib/routing.ts`, and the owner bootstrap script (`pnpm --filter @wpe/worker bootstrap-owner`, service role, idempotent, password minimum 12 characters). The web app reads only the public URL and anon key.
- Evidence: 9 routing tests (client kept out of every owner route, look-alike paths such as `/ownership` not mistaken for owner routes, signed-in user with no role gets only the login page) and 4 bootstrap tests pass; `pnpm -r typecheck` and `pnpm lint` clean; `next build` succeeds; against the production build, `/`, `/owner`, `/client` redirect (307) to `/login` when signed out and `/login` returns 200 with its error message.
- Follow-ups or blockers: a real sign-in as owner and as a client, and the client-blocked-from-owner check on live data, need the Supabase project (P1-T02). Client accounts are created by invite in phase 2 (P2-T12).

## 2026-10-08 P1-T06 Owner console shell (code done, live check open)
- What changed: `/owner` project list (stage, status, how many gates wait on the owner) and `/owner/queue` approval queue, with a nav badge (waiting count and overdue count). Each item shows its gate type (soft, hard, client), Accept, Feedback and Reject, and an overdue badge computed from `escalate_after_hours` (project override first, then the global default). Accept writes the approval, marks the artifact approved and, when the stage has no gate left, calls `advance_stage()`. Feedback and Reject are visible but disabled until phase 2; Accept on a build round waits for round review in phase 4. The queue rules are pure functions in `packages/shared/src/queue.ts`.
- Evidence: 14 queue tests (overdue boundary, override, superseded versions, prototype owner-then-client order, paused and closed projects, rounds in review, sort order), 4 render tests of the queue card, and a drift test that ties the stage-to-artifact mapping to the SQL; `pnpm lint`, `pnpm -r typecheck` and `next build` clean; the exact Accept sequence (insert approval, mark artifact approved, advance_stage) runs as the owner in the database checks (PASS 193, FAIL 0).
- Follow-ups or blockers: the pages have not been viewed with live data; that needs the Supabase project (P1-T02) and the demo in P1-T09.

## 2026-10-08 P1-T10 Encrypted backup script (script done, schedule is an owner step)
- What changed: `scripts/backup.sh` dumps the `public` and `auth` schemas with `pg_dump`, encrypts with `age` using a public key only (the private key stays in the password manager), saves to a local folder outside the repo, copies to the cloud-drive folder and verifies the copy, then deletes exports older than 180 days from both folders (D-222). It refuses folders inside the repo and unsafe labels; `scripts/backup.test.sh` checks it. Exports are already excluded by `.gitignore` (`backups/`, `*.dump`, `*.age`).
- Evidence: `bash scripts/backup.test.sh` against the scratch database: 16 checks pass (decrypts with the private key, not readable without it, holds projects, approvals and auth users, file mode 600, old files deleted from both folders, other files untouched, failed dump leaves no partial file).
- Follow-ups or blockers: the owner creates the age key pair, fills `scripts/.env.backup` and adds the crontab line from `scripts/README.md`. No restore drill (accepted risk D-069).

## 2026-10-08 P1-T09 Gate demonstration (seed script done, demo is an owner step)
- What changed: `pnpm --filter @wpe/worker seed-demo` creates a dummy project (stage intake) and a dummy `intake_record` artifact with the service role. The console's Accept (P1-T06) writes the approval, marks the artifact approved and calls `advance_stage()`. The owner steps are in `docs/plan/phase-1-owner-steps.md`.
- Evidence: the exact Accept sequence runs as the owner against the migrated scratch database (database checks: PASS 193, FAIL 0), including the stage change to the next stage; 1 test for the seed.
- Follow-ups or blockers: the click-through itself needs the Supabase project (P1-T02). Record the result here when done.

## 2026-10-08 Review of the phase 1 branch (fresh reviewer, then fixes)
- What changed: a fresh reviewer found 3 Important problems and 4 minor ones; each Important one was reproduced by a failing check first, then fixed. (1) `advance_stage()` did not check who gave an approval: it now counts an approval only from an owner (soft, hard) or from a client of that project (client gate). (2) A client could post-date an approval to get round the owner-first order of the prototype: a trigger now stamps approvals no later than the current time, and the client approval policy for the prototype needs the owner's approval first. (3) A build round could never pass after Feedback because summaries are unique per version: a round's summary is now found by `{"round": N}` in its content and its newest version counts. Also: after a client gate nothing advanced the project, so the queue now has "Ready to advance" with an Advance button (also the retry when an Accept could not finish). Minor fixes: the owner bootstrap refuses to adopt an unconfirmed existing login; `scripts/.env.backup.example` is no longer gitignored; the age key is created outside the repo (`key.txt` is ignored too); a database check that passed for the wrong reason now tests what it says; two loose assertions tightened; the owner steps say to turn off public sign-ups.
- Evidence: `bash supabase/tests/run.sh` PASS 204, FAIL 0; each fix was proven by mutation (breaking the rule made at least one check fail); 26 shared, 6 worker and 13 web tests pass; lint, typecheck, format check and `next build` clean.
- Follow-ups or blockers: migration 0002 now also holds a trigger, a policy change and two helper functions, beyond the "replace advance_stage() only" that was approved in chat; the owner should review them before applying (nothing is applied anywhere). Deferred minor: `backup.sh` passes the database URL on the `pg_dump` command line, visible to other processes of the same user on the laptop (libpq does not accept a URL from the environment); accepted for a single-user laptop. Spec differences are listed in `docs/proposals/2026-10-08-phase-1-spec-alignment.md`.

## 2026-10-13 P1-T10 Backup script keeps the password off the command line
- What changed: `scripts/backup.sh` splits `SUPABASE_DB_URL` into `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` and `PGSSLMODE` (python3, URL-decoded, shell-quoted) and runs `pg_dump` without a connection string. This closes the deferred minor finding from the phase 1 branch review. `scripts/README.md` lists python3 as a requirement.
- Evidence: `bash scripts/backup.test.sh` against the scratch Postgres, 20 checks pass (4 new: password in the URL still dumps over a password-protected connection, no connection string or password in the `pg_dump` arguments, the decoded password reaches `pg_dump` through `PGPASSWORD`, a malformed URL is refused). Mutation check: against the previous script, 3 of the new checks fail.
- Follow-ups or blockers: none.

## 2026-10-13 Questionnaire answers written up (docs only)
- What changed: `docs/proposals/2026-10-13-questionnaire-answers.md` records the owner's answers with draft rows D-235 to D-244. Plan edits: Phase 2 split into 2a and 2b with new tasks P2-T17 to P2-T22; watchdog, `stopped` status, parking, gate controls, owner emails, named signer, cancel and run controls (P2-T04, P2-T06, P2-T08, P2-T10, P2-T11, P2-T12, P2-T19 to P2-T21); eval fixtures before the Planner (P3-T03, P3-T10); parked runs and handover dry run (P4-T03, P4-T12); handover pack, freeze, close and retention (P5-T05, T06, T07, T10, T11). `AGENTS.md` gains rules 5 to 7.
- Evidence: documents only; no code or schema changed. The Claude Doc spec copy was deleted (D-236 draft).
- Follow-ups or blockers: the migrations (gate functions, cancel and close, named signer, `stopped`) are tasks with their own PRs and owner approval, not files in this PR. Owner: C8 status, live checks, A5 local Supabase run, spec edits and DECISIONS rows.

## 2026-10-13 Review of PR #6 and fixes (docs only)
- What changed: a full review found and fixed five contradictions in the plan and proposals: the 2a gate needed client logins and emails that were in 2b (P2-T11 and P2-T12 moved to 2a); P2-T04 said both "stale heartbeat re-queues" and "stale heartbeat stops" (now: re-queue, and only no-progress becomes `stopped`); rate-limit waits could be stopped by the watchdog (now a sign of life); P2-T09 still said any client login signs off (now the named signer); Cancel required an export the database cannot check (rule dropped). Added: `AGENTS.md` rule for the Supabase MCP, the questionnaire appendix, hosting decisions (draft D-245, D-246).
- Evidence: lint, typecheck, 45 unit tests, format check, `next build`, 204 database checks and 20 backup checks pass on this branch; no AI attribution in any of the 16 commit messages.
- Follow-ups or blockers: C8 (secret scanning, push protection, old token), live checks, and the owner edits to the spec and `DECISIONS.md` are still open.

## 2026-10-13 Proposals applied to the spec and decisions (docs only)
- What changed: spec edits for the three accepted proposals (PR #8, spec files only, including `stages.yaml` line 2 and `outputs`); `DECISIONS.md` rows D-229 to D-248 with statuses on D-027, D-035, D-046, D-083, D-090, D-154, D-173, D-225, D-226; proposal statuses set to accepted; plan fixes for the handover guide (P5-T05, T06, T11) and a `stages.yaml` consistency test (P2-T17).
- Evidence: yaml files parse, the 45 unit tests pass, format check clean, no stale web-editor, 7-day, "any client login" or "no time limit" wording left in `docs/spec/`.
- Follow-ups or blockers: merge this PR before PR #8 (the spec cites D-229 and later). The change-request freeze and the named signer need migrations with their own field names (P5-T10, P2-T12).

## 2026-10-13 Spec edits allowed after owner approval (docs only)
- What changed: `AGENTS.md` rule 2, the repo map, `docs/proposals/README.md`, the plan phase files and `.prettierignore` now say an agent may edit `docs/spec/` only for a proposal the owner has approved, in its own spec-only PR, with exactly the approved edits.
- Evidence: format check clean; no file under `docs/spec/` changed.
- Follow-ups or blockers: the comment on line 2 of `docs/spec/stages.yaml` still says spec files are read-only for agents; the owner approved that edit and it is applied in PR #8.

## 2026-10-13 Review of the applied proposals (docs only)
- What changed: Resume now means a new run from the last commit (D-250), console commands use a commands table (D-249), handover guides are client-visible only after the owner's approval (D-251), and the handover-script dry run moves to the start of Phase 5. Plan edits in P2-T21, P4-T12, P5-T05 and P5-T10. P5-T10 also names the migration for the change-request freeze, which no task owned.
- Evidence: documents only; spec edits are in a separate spec-only PR.
- Follow-ups or blockers: merge this PR before the spec PR (it cites D-249 to D-251).

## 2026-10-15 Migration review: 0001 and 0002 edited in place (nothing applied yet)
- What changed: the owner answered five review questions and said Go. `0001` adds `project_internal`, `clients.is_signer`, `projects.changes_frozen_at`, `run_status` `stopped`, `close_project()`, `erase_project_data()`, immutable artifacts, a stricter approvals log and project write guards, and project-bound uploads, comments and PRD feedback; `0002` makes `advance_stage()` owner-only, signer-only client approvals, database-stamped approval time and the D-251 guide trigger. Generated types, the table-count test, the spec (10, 03, 15), the plan and `DECISIONS.md` D-252 to D-256 follow; proposal `2026-10-15-migration-review.md`.
- Evidence: `bash supabase/tests/run.sh` 264 passed (204 before; `review_suite.sql` adds 57 checks, and the harness now sets Supabase's default privileges before the migrations); `pnpm typecheck`, `lint`, `test`, `format:check` clean. Mutation checks: 37 deliberate breaks of the new rules (policy removed, guard off, revoke removed, signer check dropped, retention date ignored, and so on); each made at least one check fail. One break survived on purpose: the signer check in the `0001` client approval policy, which `0002` replaces. Two checks that printed nothing when they failed were rewritten to print FAIL.
- Follow-ups or blockers: the owner must read the final `0001`/`0002` once more before `supabase db push`. Still open: typed `artifacts.type`, `stage_runs` columns for parked runs, `accept_gate` and the remaining-gates function (P2-T18), cancel (P2-T20), the commands table (D-249), and blocking new versions of an advanced stage's artifacts (D-238). The harness does not run against a real Supabase yet (P1-T08).
