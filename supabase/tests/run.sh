#!/usr/bin/env bash
# Builds a scratch database from the migration and runs the row-level security checks.
# Needs a local Postgres (14 or newer) and a role allowed to create databases.
#   WPE_TEST_DB  scratch database name (default: wpe_test, dropped and recreated each run)
# Exits non-zero if any check fails or any statement errors (1), the base load fails (2) or a mutation file fails to load (3).
#   WPE_MUTATION_SQL  space-separated SQL files that break a rule on purpose (used by mutations.sh)
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
db="${WPE_TEST_DB:-wpe_test}"

if [ -n "${WPE_SUPABASE_DB_URL:-}" ]; then
  # Local Supabase mode: Supabase already has the auth schema and the roles, and `supabase db reset`
  # has applied the migrations. Only the fixtures and the suites are loaded. Run `supabase db reset`
  # afterwards to remove the fixture rows.
  db="$WPE_SUPABASE_DB_URL"
  loads=("$here/fixtures.sql")
else
  dropdb --if-exists "$db" >/dev/null 2>&1
  createdb "$db" || { echo "cannot create database $db" >&2; exit 2; }
  loads=("$here/stub_auth.sql" "$repo"/supabase/migrations/*.sql "$here/fixtures.sql")
fi
for f in "${loads[@]}"; do
  psql -X -q -v ON_ERROR_STOP=1 -d "$db" -f "$f" >/dev/null || { echo "failed to load $f" >&2; exit 2; }
done
# Mutation mode (mutations.sh): extra SQL that deliberately breaks one rule, loaded after the fixtures so
# the fixtures load on the correct code. A file that fails to load is a stale mutation: exit 3.
if [ -n "${WPE_MUTATION_SQL:-}" ]; then
  if [ -n "${WPE_SUPABASE_DB_URL:-}" ]; then echo "WPE_MUTATION_SQL works only on the scratch database" >&2; exit 2; fi
  for f in $WPE_MUTATION_SQL; do
    psql -X -q -v ON_ERROR_STOP=1 -d "$db" -f "$f" >/dev/null || { echo "failed to load mutation $f" >&2; exit 3; }
  done
fi
out="$(for s in rls_suite advance_suite access_suite review_suite coverage_suite hardening_suite runner_suite storage_suite intake_review_suite; do psql -X -q -tA -d "$db" -f "$here/$s.sql" 2>&1; done)"
grep -E '^(PASS|FAIL)' <<<"$out"
pass=$(grep -c '^PASS' <<<"$out"); fail=$(grep -c '^FAIL' <<<"$out"); err=$(grep -c -E 'ERROR|psql:' <<<"$out")
echo "---"; echo "PASS: $pass  FAIL: $fail  ERRORS: $err"
[ "$fail" -eq 0 ] && [ "$err" -eq 0 ] && [ "$pass" -gt 0 ]
