#!/usr/bin/env bash
# The end-to-end test of the 2b flow (P2-T14). Needs a running local Supabase (`supabase start` and
# `supabase db reset`). It passes the settings to the processes it starts (no .env file is written), creates the owner login,
# loads the generic template, starts the built console and a worker on the scripted model (WPE_E2E=1, no model
# key; the prototype build still installs packages and downloads fonts), runs Playwright, and stops both. Fictional data only; never point it at a real project.
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo"

eval "$(supabase status -o env | sed -e 's/^/export SB_/')"
url="${SB_API_URL:?no API_URL from supabase status}"
anon="${SB_ANON_KEY:-${SB_PUBLISHABLE_KEY:-}}"
service="${SB_SERVICE_ROLE_KEY:-${SB_SECRET_KEY:-}}"
[ -n "$anon" ] && [ -n "$service" ] || { echo "supabase status gave no anon or service key" >&2; exit 2; }

export E2E_OWNER_EMAIL=owner@example.test
export E2E_OWNER_PASSWORD=e2e-owner-password
# The settings go to the processes started here only, never into apps/worker/.env or apps/web/.env.local:
# a real worker must never pick up the scripted model (gate review of 2026-11-20).
export MODEL_PROVIDER=scripted MODEL_NAME=e2e WPE_E2E=1 WORKER_POLL_SECONDS=2
export OWNER_EMAIL="$E2E_OWNER_EMAIL" OWNER_PASSWORD="$E2E_OWNER_PASSWORD"
export NEXT_PUBLIC_SUPABASE_URL="$url" NEXT_PUBLIC_SUPABASE_ANON_KEY="$anon"
# Variables set here win over any apps/web/.env.local (Next.js) or apps/worker/.env (not loaded here).
# The service key goes to the worker's processes only, never to the console; project files go to a scratch dir.
export WPE_WORK_DIR="$(mktemp -d)"
worker() { (cd apps/worker && SUPABASE_URL="$url" SUPABASE_SERVICE_ROLE_KEY="$service" pnpm exec tsx "src/$1"); }
worker bootstrap-owner-cli.ts
worker load-template-cli.ts
pnpm --filter @wpe/web build

pids=()
cleanup() { for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT
(cd apps/web && exec pnpm exec next start -p 3000) > /tmp/e2e-web.log 2>&1 & pids+=($!)
(cd apps/worker && SUPABASE_URL="$url" SUPABASE_SERVICE_ROLE_KEY="$service" exec pnpm exec tsx src/run-cli.ts) > /tmp/e2e-worker.log 2>&1 & pids+=($!)
for _ in $(seq 1 60); do curl -fs http://localhost:3000/login >/dev/null && break; sleep 1; done

status=0
(cd apps/web && pnpm exec playwright test) || status=$?
if [ "$status" -ne 0 ]; then
  echo "--- worker log (tail) ---"; tail -n 60 /tmp/e2e-worker.log
  echo "--- web log (tail) ---"; tail -n 40 /tmp/e2e-web.log
fi
echo "--- cost report (scripted model, tokens are not real) ---"
worker cost-report-cli.ts || true
exit "$status"
