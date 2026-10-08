#!/usr/bin/env bash
# Checks scripts/backup.sh against a scratch Postgres. Usage: WPE_TEST_DB_URL=postgresql://... bash scripts/backup.test.sh
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
url="${WPE_TEST_DB_URL:?set WPE_TEST_DB_URL to a database with the migrations applied}"
w="$(mktemp -d)"; trap 'rm -rf "$w"' EXIT
fails=0
ok()   { echo "PASS      $1"; }
fail() { echo "FAIL      $1"; fails=$((fails+1)); }
check() { if eval "$2"; then ok "$1"; else fail "$1"; fi; }

age-keygen -o "$w/key.txt" 2>/dev/null
pub="$(age-keygen -y "$w/key.txt")"
export SUPABASE_DB_URL="$url" BACKUP_AGE_RECIPIENT="$pub" BACKUP_DIR="$w/local" BACKUP_CLOUD_DIR="$w/cloud" BACKUP_ENV_FILE=/nonexistent

out="$(bash "$here/backup.sh" final-test 2>&1)"; code=$?
check "the export runs" '[ $code -eq 0 ]'
f="$(ls "$w"/local/wpe-*-final-test.dump.age 2>/dev/null | head -1)"
check "the file carries the label and the .age suffix" '[ -n "$f" ]'
check "the cloud folder has an identical copy" 'cmp -s "$f" "$w/cloud/$(basename "$f")"'
check "the file is not readable without the key (no plain pg_restore)" '! pg_restore -l "$f" >/dev/null 2>&1'
age -d -i "$w/key.txt" -o "$w/plain.dump" "$f"
check "it decrypts with the private key" '[ -s "$w/plain.dump" ]'
check "it holds the project table and the approval log" 'pg_restore -l "$w/plain.dump" | grep -q "TABLE public projects" && pg_restore -l "$w/plain.dump" | grep -q "TABLE public approvals"'
check "it holds the logins" 'pg_restore -l "$w/plain.dump" | grep -q "TABLE auth users"'
check "files are private to the owner" '[ "$(stat -c %a "$f")" = 600 ]'

touch -d '200 days ago' "$w/local/wpe-20200101T000000Z.dump.age" "$w/cloud/wpe-20200101T000000Z.dump.age"
touch -d '10 days ago' "$w/local/wpe-20990101T000000Z-recent.dump.age"
touch -d '200 days ago' "$w/local/notes.txt"
bash "$here/backup.sh" >/dev/null 2>&1
check "exports older than 180 days are deleted from both folders" '[ ! -e "$w/local/wpe-20200101T000000Z.dump.age" ] && [ ! -e "$w/cloud/wpe-20200101T000000Z.dump.age" ]'
check "recent exports are kept" '[ -e "$w/local/wpe-20990101T000000Z-recent.dump.age" ]'
check "other files are never touched" '[ -e "$w/local/notes.txt" ]'

BACKUP_KEEP_DAYS=5 bash "$here/backup.sh" >/dev/null 2>&1
check "BACKUP_KEEP_DAYS changes the limit" '[ ! -e "$w/local/wpe-20990101T000000Z-recent.dump.age" ]'

repo="$(cd "$here/.." && pwd)"
BACKUP_DIR="$repo/backups" bash "$here/backup.sh" >/dev/null 2>&1
check "a folder inside the repo is refused" '[ $? -ne 0 ] && [ ! -d "$repo/backups" -o -z "$(ls -A "$repo/backups" 2>/dev/null)" ]'
SUPABASE_DB_URL=postgresql://nobody@127.0.0.1:1/none bash "$here/backup.sh" >/dev/null 2>&1
check "a failed dump leaves no partial file and fails" '[ $? -ne 0 ] && ! ls "$w"/local/.partial-* >/dev/null 2>&1'
env -u BACKUP_AGE_RECIPIENT bash "$here/backup.sh" >/dev/null 2>&1
check "a missing key setting is refused" '[ $? -eq 2 ]'
bash "$here/backup.sh" 'bad label!' >/dev/null 2>&1
check "an unsafe label is refused" '[ $? -eq 2 ]'

echo "---"; [ $fails -eq 0 ] && echo "backup checks: all passed" || { echo "backup checks: $fails failed"; exit 1; }
