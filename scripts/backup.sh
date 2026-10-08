#!/usr/bin/env bash
# Encrypted database export (P1-T10, D-049, D-062, D-069, D-222).
#   scripts/backup.sh [label]      label is added to the file name, e.g. "final-dental" before a project close
# Settings come from the environment or from scripts/.env.backup (gitignored; see .env.backup.example):
#   SUPABASE_DB_URL       Postgres connection string of the Supabase project (Settings > Database)
#   BACKUP_AGE_RECIPIENT  age PUBLIC key. Only the public key lives on this machine; the private key
#                         stays in the owner's password manager and is needed only to restore.
#   BACKUP_DIR            local folder, outside the repo (default: ~/wpe-backups)
#   BACKUP_CLOUD_DIR      folder synced to the owner's own cloud drive
#   BACKUP_KEEP_DAYS      exports older than this are deleted from both folders (default 180, D-222)
# Needs pg_dump (same major version as the server or newer) and age.
set -euo pipefail
umask 077

here="$(cd "$(dirname "$0")" && pwd)"
env_file="${BACKUP_ENV_FILE:-$here/.env.backup}"
if [ -f "$env_file" ]; then set -a; . "$env_file"; set +a; fi

need() { [ -n "${!1:-}" ] || { echo "backup: $1 is not set (see scripts/.env.backup.example)" >&2; exit 2; }; }
need SUPABASE_DB_URL
need BACKUP_AGE_RECIPIENT
need BACKUP_CLOUD_DIR
command -v pg_dump >/dev/null || { echo "backup: pg_dump not found" >&2; exit 2; }
command -v age >/dev/null || { echo "backup: age not found (sudo apt install age)" >&2; exit 2; }

dir="${BACKUP_DIR:-$HOME/wpe-backups}"
cloud="$BACKUP_CLOUD_DIR"
keep="${BACKUP_KEEP_DAYS:-180}"
case "$keep" in ''|*[!0-9]*) echo "backup: BACKUP_KEEP_DAYS must be a number" >&2; exit 2;; esac

# Exports must never end up in the public repo.
repo="$(cd "$here/.." && pwd)"
for d in "$dir" "$cloud"; do
  real="$(realpath -m "$d")"
  case "$real" in "$repo"|"$repo"/*) echo "backup: $d is inside the repo; choose a folder outside it" >&2; exit 2;; esac
done
mkdir -p "$dir" "$cloud"

label="${1:-}"
case "$label" in *[!A-Za-z0-9_-]*) echo "backup: label may only contain letters, digits, - and _" >&2; exit 2;; esac
name="wpe-$(date -u +%Y%m%dT%H%M%SZ)${label:+-$label}.dump.age"
tmp="$(mktemp "$dir/.partial-XXXXXX")"
trap 'rm -f "$tmp"' EXIT

# public holds the data and the approval log; auth holds the logins that the rows point to.
pg_dump --format=custom --no-owner --no-privileges --schema=public --schema=auth "$SUPABASE_DB_URL" \
  | age --recipient "$BACKUP_AGE_RECIPIENT" --output "$tmp"
[ -s "$tmp" ] || { echo "backup: the export is empty" >&2; exit 1; }

mv "$tmp" "$dir/$name"
trap - EXIT
cp "$dir/$name" "$cloud/$name"
cmp -s "$dir/$name" "$cloud/$name" || { echo "backup: the cloud copy differs from the local file" >&2; exit 1; }

# Delete old exports (D-222). Only files this script names are touched.
for d in "$dir" "$cloud"; do
  find "$d" -maxdepth 1 -type f -name 'wpe-*.dump.age' -mtime +"$keep" -print -delete | sed 's/^/backup: deleted old export /'
done

echo "backup: wrote $dir/$name and copied it to $cloud"
