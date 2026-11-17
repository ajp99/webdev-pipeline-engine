'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { cancelBlocked, cancelProblem } from '@/lib/cancel-project';
import { createClient } from '@/lib/supabase/server';

export async function cancelProjectAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  await requireRole('owner', `/owner/projects/${projectId}/cancel`);
  const back = (error: string): never => {
    redirect(`/owner/projects/${projectId}/cancel?error=${encodeURIComponent(error)}`);
  };
  const supabase = await createClient();
  // The name to match comes from the database, never from the form.
  const project = await supabase
    .from('projects')
    .select('name, status, stage')
    .eq('id', projectId)
    .maybeSingle();
  if (project.error) throw new Error(project.error.message);
  if (!project.data) return back('That project no longer exists.');
  const blocked = cancelBlocked(project.data.status, project.data.stage);
  if (blocked) return back(blocked);
  const problem = cancelProblem(
    project.data.name,
    String(formData.get('typedName') ?? ''),
    String(formData.get('reason') ?? ''),
  );
  if (problem) return back(problem);
  const done = await supabase.rpc('cancel_project', {
    p_project: projectId,
    p_reason: String(formData.get('reason') ?? ''),
  });
  if (done.error) return back(done.error.message);
  revalidatePath('/owner', 'layout');
  redirect(`/owner/projects/${projectId}/cancel`);
}
