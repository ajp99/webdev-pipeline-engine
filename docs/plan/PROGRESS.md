# Progress log

Append one entry per finished task, newest at the bottom. Format:

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
- What changed: migration `0002_advance_stage.sql` replaces the stub (no table, column or policy changes; owner approved the schema change and the mapping). Rules: owner or service role only; project must be active; next stage must follow the enum order; the newest, non-superseded artifact of the stage's gating type needs an approval for every gate type in `gate_config` (global gates plus any the project adds; a project row never removes a global gate); in the prototype stage the client approval must come at or after an owner approval on the same version; build_rounds leaves only when every non-change-request round is approved and has a soft approval on its `round_summary` artifact (version = round number); handover to closed also sets status closed and reason completed (D-220); release-note approvals never count (D-223). `supabase/tests/advance_suite.sql` has 34 checks and `run.sh` now loads every migration and both suites.
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
