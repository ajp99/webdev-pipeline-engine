#!/usr/bin/env bash
# Writes apps/web/.env.local and apps/worker/.env from the running local Supabase (owner steps 4 and 6).
# Prints no key. Needs `supabase start` to be running. Asks for the owner email and a password (hidden).
# Refuses to overwrite an existing file unless you pass --force. Run `pnpm doctor` afterwards.
# Usage: bash scripts/setup-env.sh [--force]
set -euo pipefail
cd "$(dirname "$0")/.."

force=0
[ "${1:-}" = "--force" ] && force=1
for f in apps/web/.env.local apps/worker/.env; do
  if [ -e "$f" ] && [ "$force" -eq 0 ]; then
    echo "$f already exists; pass --force to replace it" >&2
    exit 1
  fi
done

eval "$(supabase status -o env 2>/dev/null)"
if [ -z "${API_URL:-}" ] || [ -z "${ANON_KEY:-}" ] || [ -z "${SERVICE_ROLE_KEY:-}" ]; then
  echo "Could not read the local Supabase keys. Run: supabase start" >&2
  exit 1
fi

read -r -p "Owner email: " OWNER_EMAIL
read -r -s -p "Owner password (12+ characters, not shown): " OWNER_PASSWORD
echo
if [ "${#OWNER_PASSWORD}" -lt 12 ]; then
  echo "The password must have 12 or more characters." >&2
  exit 1
fi
case "$OWNER_PASSWORD" in
  *[\"\'\ \#\$\\]*) echo "Avoid spaces, quotes, #, \$ and backslashes in the password." >&2; exit 1 ;;
esac

umask 077
cat > apps/web/.env.local <<ENV
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
ENV
cat > apps/worker/.env <<ENV
SUPABASE_URL=$API_URL
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
OWNER_EMAIL=$OWNER_EMAIL
OWNER_PASSWORD=$OWNER_PASSWORD
ENV

pnpm --filter @wpe/worker bootstrap-owner
sed -i '/^OWNER_PASSWORD=/d' apps/worker/.env
echo "Wrote the two env files and removed OWNER_PASSWORD. Now run: pnpm doctor"
