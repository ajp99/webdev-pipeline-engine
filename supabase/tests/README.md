# Database checks

Row-level security, schema and `advance_stage()` checks for the migrations in `supabase/migrations/`.

```
bash supabase/tests/run.sh
```

Needs a local Postgres (14 or newer) and a role allowed to create databases. The script drops and recreates a scratch database (`wpe_test`, or `$WPE_TEST_DB`), loads a stand-in for Supabase's auth schema and default privileges (`stub_auth.sql`), the fixture rows (`fixtures.sql`), then runs `rls_suite.sql` (row-level security and schema facts), `advance_suite.sql` (`advance_stage()`, migration 0002), `access_suite.sql` (anon, owners, append-only approvals, uploads, queue claim) and `review_suite.sql` (owner-only project fields, project and close guards, approvals, the named signer, the change-request freeze, immutable artifacts, `erase_project_data()`) `coverage_suite.sql` (checks added after a deliberate break got past the others) and `hardening_suite.sql` (the review-panel rules: approval hash and email snapshot, gate configuration and gatekeeper, one active run per project, run tracing, intake answers, private schema and empty `search_path`). Each check prints `PASS` or `FAIL`, and the script exits non-zero if any check fails.

- Each check runs one statement as a Supabase role (`authenticated` as the owner or a client, or `service_role`) inside a savepoint that is always rolled back, and compares the result with the expected outcome (`ok:N` rows, or `error`).
- The suite walks one project through the stages (intake, requirements, plan, prototype, build rounds, QC, deploy prep, handover, closed) and checks, at each, what a client may read and write, including paused and closed projects.
- CI runs this script on every pull request (`.github/workflows/ci.yml`, D-287); it can also be run by hand.

## Against a local Supabase (needs Docker)

```
supabase start
supabase db reset                      # applies every migration
WPE_SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres bash supabase/tests/run.sh
supabase db reset                      # removes the fixture rows
```

In this mode the script skips the auth stand-in and the migrations and loads only the fixtures and the suites. The `supabase` job in CI runs this mode on every pull request (it passed on GitHub on 2026-10-15, PR #15); the agent's own sandbox has no Docker. Task P1-T08 stays open until its remaining checks are extended and the owner has run it on their machine.

## Mutation check (D-288)

```
bash supabase/tests/mutations.sh              # every mutation, about 2 minutes
bash supabase/tests/mutations.sh approval 48  # only files whose name contains an argument
```

Every database or access rule must be proved by breaking it (`AGENTS.md` rule 5). Each file in `mutations/` breaks one rule on purpose, as SQL applied after the fixtures: drop a trigger or constraint, loosen a policy, or patch one piece of text in a function with `m.patch_fn(signature, old, new)` (`mutations/_helpers.sql`; it fails if the text is not found exactly once, so a stale mutation cannot pass quietly). The script first requires the unmodified suites to pass, then runs the suites once per mutation and requires at least one `FAIL`:

- `killed`: a check noticed the break.
- `SURVIVED`: every check passed with the rule broken. Add a check (usually in `coverage_suite.sql`) and run again.
- `INVALID`: the mutation SQL no longer applies, for example because the function it patches changed. Update the file.

The script exits non-zero on any survivor or invalid mutation. A new or changed rule needs a new file in `mutations/` (numbered, one rule each) in the same PR. CI runs it on pull requests that touch `supabase/**` and on demand (`.github/workflows/mutations.yml`). It works only on the scratch database, not on a local Supabase.
