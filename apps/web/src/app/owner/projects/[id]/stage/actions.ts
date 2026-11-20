'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { runBlocked, STAGE_ARTIFACT } from '@/lib/stage-run';
import { createClient } from '@/lib/supabase/server';

/**
 * Run: queues a run for the project's current stage (the stage is read from the database, never from the
 * form). The runner picks it up; the database refuses a paused project, a stage mismatch or a second queued run.
 */
export async function runStage(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  await requireRole('owner', `/owner/projects/${projectId}/stage`);
  const supabase = await createClient();
  const back = (key: 'error' | 'notice', text: string): never => {
    revalidatePath('/owner', 'layout');
    redirect(`/owner/projects/${projectId}/stage?${key}=${encodeURIComponent(text)}`);
  };
  const project = await supabase
    .from('projects')
    .select('stage, status')
    .eq('id', projectId)
    .maybeSingle();
  if (project.error) throw new Error(project.error.message);
  if (!project.data) return back('error', 'That project no longer exists.');
  const open = await supabase
    .from('stage_runs')
    .select('id')
    .eq('project_id', projectId)
    .in('status', ['queued', 'running', 'waiting', 'cancel_requested'])
    .limit(1);
  if (open.error) throw new Error(open.error.message);
  let newestApproved = false;
  const type = STAGE_ARTIFACT[project.data.stage];
  if (type) {
    const newest = await supabase
      .from('artifacts')
      .select('status')
      .eq('project_id', projectId)
      .eq('type', type as 'prd' | 'plan' | 'prototype')
      .order('version', { ascending: false })
      .limit(1);
    if (newest.error) throw new Error(newest.error.message);
    newestApproved = newest.data?.[0]?.status === 'approved';
  }
  const blocked = runBlocked({
    stage: project.data.stage,
    status: project.data.status,
    hasOpenRun: (open.data ?? []).length > 0,
    newestApproved,
  });
  if (blocked) return back('error', blocked);
  const queued = await supabase.rpc('enqueue_run', {
    p_project: projectId,
    p_stage: project.data.stage,
  });
  if (queued.error) return back('error', queued.error.message);
  return back('notice', 'Run queued. The runner picks it up within about 30 seconds.');
}
