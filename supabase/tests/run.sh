#!/usr/bin/env bash
# Builds a scratch database from the migration and runs the row-level security checks.
# Needs a local Postgres (14 or newer) and a role allowed to create databases.
#   WPE_TEST_DB  scratch database name (default: wpe_test, dropped and recreated each run)
# Exits non-zero if any check fails or any statement errors.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
db="${WPE_TEST_DB:-wpe_test}"

dropdb --if-exists "$db" >/dev/null 2>&1
createdb "$db" || { echo "cannot create database $db" >&2; exit 2; }
for f in "$here/stub_auth.sql" "$repo/supabase/migrations/0001_init.sql" "$here/fixtures.sql"; do
  psql -X -q -v ON_ERROR_STOP=1 -d "$db" -f "$f" >/dev/null || { echo "failed to load $f" >&2; exit 2; }
done
out="$(psql -X -q -tA -d "$db" -f "$here/rls_suite.sql" 2>&1)"
grep -E '^(PASS|FAIL)' <<<"$out"
pass=$(grep -c '^PASS' <<<"$out"); fail=$(grep -c '^FAIL' <<<"$out"); err=$(grep -c -E 'ERROR|psql:' <<<"$out")
echo "---"; echo "PASS: $pass  FAIL: $fail  ERRORS: $err"
[ "$fail" -eq 0 ] && [ "$err" -eq 0 ] && [ "$pass" -gt 0 ]
