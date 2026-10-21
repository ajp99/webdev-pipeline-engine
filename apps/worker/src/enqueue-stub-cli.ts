// Run with: pnpm --filter @wpe/worker enqueue-stub [projectId]   (reads apps/worker/.env)
// Queues a stub run (a fake task of about a minute) so the runner can be tried end to end.
// With no project id it creates a throwaway project first. Cancel the run from the console.
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@wpe/shared';

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set in apps/worker/.env`);
  return v;
}

const admin = createClient<Database>(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});
let projectId = process.argv[2];
if (!projectId) {
  const label = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const { data, error } = await admin
    .from('projects')
    .insert({ name: `Stub run ${label}` })
    .select('id')
    .single();
  if (error) throw new Error(`Could not create the project: ${error.message}`);
  projectId = data.id;
}
const project = await admin.from('projects').select('stage').eq('id', projectId).single();
if (project.error) throw new Error(`Could not read the project: ${project.error.message}`);
const queued = await admin.rpc('enqueue_run', {
  p_project: projectId,
  p_stage: project.data.stage,
});
if (queued.error) throw new Error(`enqueue_run: ${queued.error.message}`);
// The runner picks a handler from the run's model. If it claimed the run before this update, the run
// fails ("no handler") and the database retries it once, by which time the model is set.
const marked = await admin.from('stage_runs').update({ model: 'stub' }).eq('id', queued.data);
if (marked.error) throw new Error(`Could not mark the run as a stub: ${marked.error.message}`);
console.log(`Queued stub run ${queued.data} for project ${projectId}.`);
console.log('Start the runner (pnpm --filter @wpe/worker start) and open Runs in the console.');
