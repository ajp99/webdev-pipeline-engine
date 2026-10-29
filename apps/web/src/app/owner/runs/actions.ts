'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { canRetry } from '@/lib/runs';
import { createClient } from '@/lib/supabase/server';

/**
 * Cancel: asks the database to cancel a run. A queued run is cancelled at once; a running one is
 * marked cancel_requested and the worker stops it at its next heartbeat (D-301). The database
 * decides whether the run can still be cancelled.
 */
export async function cancelRun(formData: FormData) {
  await requireRole('owner', '/owner/runs');
  const runId = String(formData.get('runId') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.rpc('request_run_cancel', { p_run: runId });
  // A run that finished between the page load and the click is not an error: show the page as it is now.
  if (error && !/already/.test(error.message)) throw new Error(error.message);
  revalidatePath('/owner', 'layout');
}

/**
 * Retry: a new queued run for the same project and stage, with fresh attempts. The old run stays as
 * history (D-233). The database refuses when the project has moved on, is not active or already has a
 * queued run; that message is shown on the run's page instead of an error screen.
 */
export async function retryRun(formData: FormData) {
  const runId = String(formData.get('runId') ?? '');
  await requireRole('owner', `/owner/runs/${runId}`);
  const supabase = await createClient();
  const run = await supabase
    .from('stage_runs')
    .select('project_id, stage, status')
    .eq('id', runId)
    .maybeSingle();
  if (run.error) throw new Error(run.error.message);
  const back = (key: 'error' | 'notice', text: string, id = runId): never => {
    revalidatePath('/owner', 'layout');
    redirect(`/owner/runs/${id}?${key}=${encodeURIComponent(text)}`);
  };
  if (!run.data) return back('error', 'That run no longer exists.');
  if (!canRetry(run.data.status))
    return back('error', 'Only a failed, stopped or cancelled run can be retried.');
  const queued = await supabase.rpc('enqueue_run', {
    p_project: run.data.project_id,
    p_stage: run.data.stage,
  });
  if (queued.error) return back('error', queued.error.message);
  return back('notice', 'Retry queued. The runner picks it up.', queued.data);
}
