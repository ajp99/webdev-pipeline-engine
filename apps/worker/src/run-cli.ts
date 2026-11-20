// Run with: pnpm --filter @wpe/worker start   (reads apps/worker/.env). Stop with Ctrl+C.
import { hostname } from 'node:os';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@wpe/shared';
import { agentDeps } from './builder-agent';
import { builderHandler } from './builder';
import {
  checkBuild,
  prepareWorkdir,
  startPreview,
  stopAllPreviews,
  stopPreview,
} from './builder-host';
import { defaultSelector } from './handlers';
import { intakeReviewHandler, unconfiguredReviewHandler } from './intake-review';
import { supabaseReviewDeps } from './intake-review-supabase';
import { modelFromEnv } from './model';
import { requirementsHandler } from './requirements';
import { supabaseRequirementsDeps } from './requirements-supabase';
import { DEFAULTS, startRunner } from './runner';
import { supabaseRunnerDeps } from './runner-supabase';
import { stubStageHandler } from './stage-stubs';
import { supabaseStubDeps } from './stage-stubs-supabase';

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
// The intake review and the requirements agent need a model (MODEL_PROVIDER in .env, D-316). Without one
// the worker still runs; such a run then fails with the reason, shown in the console's queue.
let review;
let requirements;
try {
  const model = modelFromEnv(process.env);
  review = intakeReviewHandler(supabaseReviewDeps(admin), model);
  requirements = requirementsHandler(supabaseRequirementsDeps(admin), model);
  console.log(`Intake review and requirements use ${model.name}.`);
} catch (e) {
  const reason = e instanceof Error ? e.message : String(e);
  console.log(`Intake review and requirements are off: ${reason}`);
  review = unconfiguredReviewHandler(reason);
  requirements = unconfiguredReviewHandler(reason);
}
// The walking skeleton (P2-T23): stub stage agents, and the Builder on this computer with your Claude Code
// login (no API key; sign in once with `claude`). The preview is a local dev server.
const stubDeps = supabaseStubDeps(admin);
const skeleton = {
  requirements,
  stubs: stubStageHandler(stubDeps),
  builder: builderHandler({
    loadApproved: stubDeps.loadApproved,
    prepare: prepareWorkdir,
    stopPreview,
    check: checkBuild,
    startPreview: (dir, io) => startPreview(dir, io),
    ...agentDeps(process.env),
  }),
};
const runner = startRunner(
  supabaseRunnerDeps(admin),
  defaultSelector(process.env, review, skeleton),
  {
    worker,
    heartbeatMs: DEFAULTS.heartbeatMs,
    watchdogMs: DEFAULTS.watchdogMs,
    graceMs: DEFAULTS.graceMs,
    pollMinMs: fixedPoll ?? DEFAULTS.pollMinMs,
    pollMaxMs: fixedPoll ?? DEFAULTS.pollMaxMs,
    maxParallel: Math.floor(positive('WORKER_MAX_PARALLEL_PROJECTS', DEFAULTS.maxParallel)),
    log: (m) => console.log(`${new Date().toISOString()} ${m}`),
  },
);
console.log(`Runner ${worker} started. Looking for work every 15 to 30 seconds. Ctrl+C to stop.`);
let stopRequested = false;
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    if (stopRequested) {
      console.log('Stopping now. The run in progress will be picked up again after 10 minutes.');
      void stopAllPreviews().finally(() => process.exit(1));
      return;
    }
    stopRequested = true;
    console.log('Stopping after the current run... press Ctrl+C again to stop now.');
    // Previews started by this worker stop with it.
    void runner
      .stop()
      .then(() => stopAllPreviews())
      .then(() => process.exit(0));
  });
}
