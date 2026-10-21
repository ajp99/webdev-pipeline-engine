// Run with: pnpm --filter @wpe/worker start   (reads apps/worker/.env). Stop with Ctrl+C.
import { hostname } from 'node:os';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@wpe/shared';
import { defaultSelector } from './handlers';
import { DEFAULTS, startRunner } from './runner';
import { supabaseRunnerDeps } from './runner-supabase';

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set in apps/worker/.env`);
  return v;
}

const admin = createClient<Database>(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const fixedPoll = process.env.WORKER_POLL_SECONDS
  ? Number(process.env.WORKER_POLL_SECONDS) * 1000
  : null;
const worker = `${hostname()}-${process.pid}`;
const runner = startRunner(supabaseRunnerDeps(admin), defaultSelector(process.env), {
  worker,
  heartbeatMs: DEFAULTS.heartbeatMs,
  watchdogMs: DEFAULTS.watchdogMs,
  graceMs: DEFAULTS.graceMs,
  pollMinMs: fixedPoll ?? DEFAULTS.pollMinMs,
  pollMaxMs: fixedPoll ?? DEFAULTS.pollMaxMs,
  maxParallel: Number(process.env.WORKER_MAX_PARALLEL_PROJECTS ?? DEFAULTS.maxParallel),
  log: (m) => console.log(`${new Date().toISOString()} ${m}`),
});
console.log(`Runner ${worker} started. Looking for work every 15 to 30 seconds. Ctrl+C to stop.`);
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    console.log('Stopping after the current run...');
    void runner.stop().then(() => process.exit(0));
  });
}
