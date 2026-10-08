# Database checks

Row-level security and schema checks for `supabase/migrations/0001_init.sql`.

```
bash supabase/tests/run.sh
```

Needs a local Postgres (14 or newer) and a role allowed to create databases. The script drops and recreates a scratch database (`wpe_test`, or `$WPE_TEST_DB`), loads a stand-in for Supabase's auth schema (`stub_auth.sql`), the migration, the fixture rows (`fixtures.sql`), then runs `rls_suite.sql`. Each check prints `PASS` or `FAIL`, and the script exits non-zero if any check fails.

- Each check runs one statement as a Supabase role (`authenticated` as the owner or a client, or `service_role`) inside a savepoint that is always rolled back, and compares the result with the expected outcome (`ok:N` rows, or `error`).
- The suite walks one project through the stages (intake, requirements, plan, prototype, build rounds, QC, deploy prep, handover, closed) and checks, at each, what a client may read and write, including paused and closed projects.
- Run by hand until CI exists (D-046). Task P1-T08 moves these checks onto a local Supabase (Supabase CLI and Docker) and extends them.
