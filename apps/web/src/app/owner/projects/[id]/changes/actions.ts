'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { DECISIONS, parseList } from '@/lib/prd-view';
import { createClient } from '@/lib/supabase/server';

function back(projectId: string, key: 'error' | 'notice', text: string): never {
  revalidatePath('/owner', 'layout');
  redirect(`/owner/projects/${projectId}/changes?${key}=${encodeURIComponent(text)}`);
}

/** Record: a change request the client sent outside the pipeline (P2-T10, D-326). The database checks the window. */
export async function recordChange(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  await requireRole('owner', `/owner/projects/${projectId}/changes`);
  const description = String(formData.get('description') ?? '').trim();
  if (!description) return back(projectId, 'error', 'Describe the change the client asked for.');
  if (description.length > 4000)
    return back(projectId, 'error', 'The description can be at most 4000 characters.');
  const pages = parseList(String(formData.get('pages') ?? ''));
  const features = parseList(String(formData.get('features') ?? ''));
  if (!pages.ok) return back(projectId, 'error', `Pages: ${pages.error}`);
  if (!features.ok) return back(projectId, 'error', `Features: ${features.error}`);
  const supabase = await createClient();
  const saved = await supabase.from('change_requests').insert({
    project_id: projectId,
    description,
    affected_pages: pages.items,
    affected_features: features.items,
  });
  if (saved.error) return back(projectId, 'error', saved.error.message);
  return back(projectId, 'notice', 'Change request recorded. Decide it below.');
}

/** Decide: the owner's decision with the impact note, through decide_change_request. */
export async function decideChange(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  await requireRole('owner', `/owner/projects/${projectId}/changes`);
  const requestId = String(formData.get('requestId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const note = String(formData.get('impactNote') ?? '').trim();
  const known = DECISIONS.find((d) => d.value === decision);
  if (!known) return back(projectId, 'error', 'Choose a decision.');
  if (!note)
    return back(
      projectId,
      'error',
      'Write the impact note: what the change costs in time and scope.',
    );
  const supabase = await createClient();
  const decided = await supabase.rpc('decide_change_request', {
    p_request: requestId,
    p_decision: known.value,
    p_impact_note: note,
  });
  if (decided.error) return back(projectId, 'error', decided.error.message);
  return back(
    projectId,
    'notice',
    known.value === 'accept_current_round'
      ? 'Accepted. Now write the PRD version for it.'
      : `Decision recorded: ${known.label.toLowerCase()}.`,
  );
}
