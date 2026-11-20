'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { planFromForm } from '@/lib/plan-edit';
import { createClient } from '@/lib/supabase/server';

/**
 * Saves the owner's edit as the next plan version (P3-T03), a draft that needs the owner's Accept. Refused when
 * the plan changed since the editor opened, when the newest version is already approved, or while the Planner is
 * drafting (its draft would bury this one). Through the API the owner can only insert a draft (D-327).
 */
export async function savePlan(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const projectId = String(formData.get('projectId') ?? '');
  const user = await requireRole('owner', `/owner/projects/${projectId}`);
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const form = planFromForm(values);
  if (!form.ok) return { error: form.error };
  const base = Number(values.baseVersion);
  const supabase = await createClient();
  const [project, newest, active] = await Promise.all([
    supabase.from('projects').select('stage, status').eq('id', projectId).maybeSingle(),
    supabase
      .from('artifacts')
      .select('version, status')
      .eq('project_id', projectId)
      .eq('type', 'plan')
      .order('version', { ascending: false })
      .limit(1),
    supabase
      .from('stage_runs')
      .select('id')
      .eq('project_id', projectId)
      .eq('stage', 'plan')
      .in('status', ['queued', 'running', 'waiting'])
      .limit(1),
  ]);
  for (const r of [project, newest, active]) if (r.error) throw new Error(r.error.message);
  if (project.data?.stage !== 'plan' || project.data.status !== 'active')
    return { error: 'The plan can be edited while the project is active at the plan stage.' };
  const top = newest.data?.[0];
  if ((top?.version ?? 0) !== base)
    return {
      error: `The plan changed since you opened it (newest is version ${top?.version ?? 0}); reload and edit again.`,
    };
  if (top?.status === 'approved')
    return { error: 'The newest plan is accepted; it can no longer be edited.' };
  if ((active.data ?? []).length)
    return { error: 'The Planner is drafting; wait for its run to finish, then edit.' };
  const saved = await supabase.from('artifacts').insert({
    project_id: projectId,
    type: 'plan',
    version: base + 1,
    status: 'draft',
    content: form.plan,
    created_by: user.userId,
  });
  if (saved.error) return { error: saved.error.message };
  revalidatePath('/owner', 'layout');
  redirect(
    `/owner/projects/${encodeURIComponent(projectId)}/stage?notice=${encodeURIComponent(`Saved as plan version ${base + 1}. Accept it from the approval queue.`)}`,
  );
}
