# Database checks

Row-level security, schema and `advance_stage()` checks for the migrations in `supabase/migrations/`.

```
bash supabase/tests/run.sh
```

Needs a local Postgres (14 or newer) and a role allowed to create databases. The script drops and recreates a scratch database (`wpe_test`, or `$WPE_TEST_DB`), loads a stand-in for Supabase's auth schema and default privileges (`stub_auth.sql`), the migration (`0001_init.sql`, the squashed baseline, D-308), the fixture rows (`fixtures.sql`), then runs `rls_suite.sql` (row-level security for the owner and for a user who is not an owner, schema facts), `advance_suite.sql` (`advance_stage()`, the owner-given approvals and the client-gate evidence note), `access_suite.sql` (anon, owners, append-only approvals, uploads, queue claim, the owner recording the client gate), `review_suite.sql` (owner-only project fields, project and close guards, the one-active-run slot including `cancel_requested`, immutable artifacts), `coverage_suite.sql` (checks added after a deliberate break got past the others) and `hardening_suite.sql` (approval hash and email snapshot, gate configuration and gatekeeper, run tracing, private schema and empty `search_path`). Each check prints `PASS` or `FAIL`, and the script exits non-zero if any check fails.

- Each check runs one statement as a Supabase role (`authenticated` as the owner or as a user who is not an owner, `anon`, or `service_role`) inside a savepoint that is always rolled back, and compares the result with the expected outcome (`ok:N` rows, or `error`).
- Until go-live the owner is the only login (D-298): the checks cover what the owner can do and that anyone else sees and changes nothing. Client-side rules return with the client dashboard (go-live G15).
- CI runs this script on every pull request (`.github/workflows/ci.yml`, D-287); it can also be run by hand.

## Against a local Supabase (needs Docker)

```
supabase start
supabase db reset                      # applies the migration
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

Locally run only the files for the rules your change touches (name arguments, above); the full run happens in CI on every pull request that touches `supabase/**` and at each phase gate (D-311), and a stale or surviving mutation fails it there. The script exits non-zero on any survivor or invalid mutation. A new or changed rule needs a new file in `mutations/` (numbered, one rule each) in the same PR. CI runs it on pull requests that touch `supabase/**` and on demand (`.github/workflows/mutations.yml`). It works only on the scratch database, not on a local Supabase.
