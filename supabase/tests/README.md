# Database checks

Row-level security, schema and `advance_stage()` checks for the migrations in `supabase/migrations/`.

```
bash supabase/tests/run.sh
```

Needs a local Postgres (14 or newer) and a role allowed to create databases. The script drops and recreates a scratch database (`wpe_test`, or `$WPE_TEST_DB`), loads a stand-in for Supabase's auth schema and default privileges (`stub_auth.sql`), the fixture rows (`fixtures.sql`), then runs `rls_suite.sql` (row-level security and schema facts), `advance_suite.sql` (`advance_stage()`, migration 0002), `access_suite.sql` (anon, owners, append-only approvals, uploads, queue claim) and `review_suite.sql` (owner-only project fields, project and close guards, approvals, the named signer, the change-request freeze, immutable artifacts, `erase_project_data()`). Each check prints `PASS` or `FAIL`, and the script exits non-zero if any check fails.

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

In this mode the script skips the auth stand-in and the migrations and loads only the fixtures and the suites. This mode has not been run yet: the agent's sandbox has no Docker. The `supabase` job in CI runs it, but it does not block merging until it has passed once (it is marked `continue-on-error`). Task P1-T08 stays open until it has been run once with all checks passing.
