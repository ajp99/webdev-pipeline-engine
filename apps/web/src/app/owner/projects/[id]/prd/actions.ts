'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { prdFromForm } from '@/lib/prd-view';
import { createClient } from '@/lib/supabase/server';

const NOTE_MAX = 2000;
const FEEDBACK_MAX = 4000;

function back(projectId: string, key: 'error' | 'notice', text: string, page = 'prd'): never {
  revalidatePath('/owner', 'layout');
  redirect(`/owner/projects/${projectId}/${page}?${key}=${encodeURIComponent(text)}`);
}

/**
 * Save: a new PRD version written by the owner (P2-T08, D-324). save_prd_version checks the base version (no
 * overwriting a newer one), the shape, the stage and, after the sign-off, the accepted change request.
 */
export async function savePrd(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  await requireRole('owner', `/owner/projects/${projectId}/prd`);
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const base = Number(values.baseVersion);
  const cr = values.changeRequestId || null;
  const form = prdFromForm(values);
  const editPage = `prd/edit${cr ? `?cr=${cr}&` : '?'}`;
  if (!form.ok) {
    revalidatePath('/owner', 'layout');
    redirect(`/owner/projects/${projectId}/${editPage}error=${encodeURIComponent(form.error)}`);
  }
  if (!Number.isInteger(base) || base < 0)
    return back(projectId, 'error', 'Reload the editor and try again.');
  const supabase = await createClient();
  const saved = await supabase.rpc('save_prd_version', {
    p_project: projectId,
    p_base_version: base,
    p_content: form.content,
    ...(cr ? { p_change_request: cr } : {}),
  });
  if (saved.error) return back(projectId, 'error', saved.error.message);
  return back(projectId, 'notice', 'Saved as a new version.');
}

/**
 * Sign off: the owner records the client's sign-off of a PRD version, with a note naming the channel (P2-T09,
 * D-298). accept_gate checks the version is the newest and the stage is requirements; the project still
 * waits for the owner's Advance in the queue.
 */
export async function recordSignOff(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  await requireRole('owner', `/owner/projects/${projectId}/prd`);
  const artifactId = String(formData.get('artifactId') ?? '');
  const note = String(formData.get('note') ?? '').trim();
  if (!note)
    return back(
      projectId,
      'error',
      'Say how the client signed off (for example: email of 3 March).',
    );
  if (note.length > NOTE_MAX)
    return back(projectId, 'error', `The note can be at most ${NOTE_MAX} characters.`);
  const supabase = await createClient();
  const accepted = await supabase.rpc('accept_gate', {
    p_project: projectId,
    p_gate: 'client',
    p_artifact: artifactId,
    p_note: note,
  });
  if (accepted.error) return back(projectId, 'error', accepted.error.message);
  return back(
    projectId,
    'notice',
    'Sign-off recorded. Advance the project from the approval queue when ready.',
  );
}

/** Request changes: the client's note on a PRD version, for the owner only; agents never read it (D-087). */
export async function recordFeedback(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  const user = await requireRole('owner', `/owner/projects/${projectId}/prd`);
  const artifactId = String(formData.get('artifactId') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return back(projectId, 'error', 'Write what the client asked to change.');
  if (body.length > FEEDBACK_MAX)
    return back(projectId, 'error', `The note can be at most ${FEEDBACK_MAX} characters.`);
  const supabase = await createClient();
  const saved = await supabase
    .from('prd_feedback')
    .insert({ project_id: projectId, artifact_id: artifactId, body, created_by: user.userId });
  if (saved.error) return back(projectId, 'error', saved.error.message);
  return back(
    projectId,
    'notice',
    'The client’s request is recorded. Edit the PRD, or add notes and run the stage again.',
  );
}
