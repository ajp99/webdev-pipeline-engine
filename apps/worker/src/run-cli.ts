// Run with: pnpm --filter @wpe/worker start   (reads apps/worker/.env). Stop with Ctrl+C.
import { hostname } from 'node:os';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@wpe/shared';
import { defaultSelector } from './handlers';
import { intakeReviewHandler, unconfiguredReviewHandler } from './intake-review';
import { supabaseReviewDeps } from './intake-review-supabase';
import { modelFromEnv } from './model';
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
function positive(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0)
    throw new Error(`${name} must be a positive number, got "${raw}"`);
  return n;
}
const fixedPoll = process.env.WORKER_POLL_SECONDS
  ? positive('WORKER_POLL_SECONDS', 15) * 1000
  : null;
const worker = `${hostname()}-${process.pid}`;
// The intake review needs a model (MODEL_PROVIDER in .env, D-316). Without one the worker still runs;
// an intake run then fails with the reason, shown in the console's queue.
let review;
try {
  const model = modelFromEnv(process.env);
  review = intakeReviewHandler(supabaseReviewDeps(admin), model);
  console.log(`Intake review uses ${model.name}.`);
} catch (e) {
  const reason = e instanceof Error ? e.message : String(e);
  console.log(`Intake review is off: ${reason}`);
  review = unconfiguredReviewHandler(reason);
}
const runner = startRunner(supabaseRunnerDeps(admin), defaultSelector(process.env, review), {
  worker,
  heartbeatMs: DEFAULTS.heartbeatMs,
  watchdogMs: DEFAULTS.watchdogMs,
  graceMs: DEFAULTS.graceMs,
  pollMinMs: fixedPoll ?? DEFAULTS.pollMinMs,
  pollMaxMs: fixedPoll ?? DEFAULTS.pollMaxMs,
  maxParallel: Math.floor(positive('WORKER_MAX_PARALLEL_PROJECTS', DEFAULTS.maxParallel)),
  log: (m) => console.log(`${new Date().toISOString()} ${m}`),
});
console.log(`Runner ${worker} started. Looking for work every 15 to 30 seconds. Ctrl+C to stop.`);
let stopRequested = false;
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    if (stopRequested) {
      console.log('Stopping now. The run in progress will be picked up again after 10 minutes.');
      process.exit(1);
    }
    stopRequested = true;
    console.log('Stopping after the current run... press Ctrl+C again to stop now.');
    void runner.stop().then(() => process.exit(0));
  });
}
