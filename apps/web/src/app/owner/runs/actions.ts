'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
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
