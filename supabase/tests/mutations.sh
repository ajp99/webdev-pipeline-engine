#!/usr/bin/env bash
# Mutation check for the database rules (P1-T13, D-288, AGENTS.md rule 5).
# Each file in supabase/tests/mutations/NN-name.sql breaks one rule on purpose. For each one this script
# builds the scratch database, applies the break after the fixtures, runs the suites and requires at least
# one check to FAIL. A break that every check lets through (SURVIVED), or one whose SQL no longer applies
# (INVALID, for example because the function it patches changed), makes the script exit non-zero.
#   bash supabase/tests/mutations.sh              all mutations
#   bash supabase/tests/mutations.sh 07 approvals  only files whose name starts with or contains an argument
#   WPE_TEST_DB  scratch database name (default: wpe_mutation)
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
export WPE_TEST_DB="${WPE_TEST_DB:-wpe_mutation}"
# Two runs on one scratch database would drop it under each other and give false results.
exec 9>"${TMPDIR:-/tmp}/wpe-mutations-$WPE_TEST_DB.lock"
flock -n 9 || { echo "another mutation run is using $WPE_TEST_DB; wait for it or set WPE_TEST_DB" >&2; exit 2; }
unset WPE_SUPABASE_DB_URL

base="$(bash "$here/run.sh" 2>&1)"; rc=$?
if [ "$rc" -ne 0 ]; then
  echo "$base" | tail -5
  echo "The unmodified suites do not pass (exit $rc); mutation results would mean nothing." >&2
  exit 2
fi
echo "baseline: $(tail -1 <<<"$base")"

killed=0; survived=0; invalid=0; total=0
for f in "$here"/mutations/[0-9]*.sql; do
  name="$(basename "$f" .sql)"
  if [ "$#" -gt 0 ]; then
    match=0; for a in "$@"; do case "$name" in *"$a"*) match=1;; esac; done
    [ "$match" -eq 1 ] || continue
  fi
  total=$((total + 1))
  out="$(WPE_MUTATION_SQL="$here/mutations/_helpers.sql $f" bash "$here/run.sh" 2>&1)"; rc=$?
  if [ "$rc" -eq 3 ] || [ "$rc" -eq 2 ]; then
    invalid=$((invalid + 1)); echo "INVALID   $name: $(grep -m1 -E 'ERROR|failed' <<<"$out")"
    continue
  fi
  fails="$(grep -c '^FAIL' <<<"$out")"
  if [ "$fails" -ge 1 ]; then
    killed=$((killed + 1)); echo "killed    $name ($fails checks failed; first: $(grep -m1 '^FAIL' <<<"$out" | cut -c11-90))"
  else
    survived=$((survived + 1)); echo "SURVIVED  $name  (all checks passed with the rule broken)"
  fi
done
echo "---"; echo "mutations: $total  killed: $killed  survived: $survived  invalid: $invalid"
[ "$total" -gt 0 ] && [ "$survived" -eq 0 ] && [ "$invalid" -eq 0 ]
