'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import {
  DISPOSITION,
  marksFromForm,
  NOTE_ACTIONS,
  skillsUsed,
  type NoteAction,
} from '@/lib/plan-edit';
import { createClient } from '@/lib/supabase/server';

const NOTE_MAX = 5000;
const STAGE_OF: Record<string, 'plan' | 'prototype'> = { plan: 'plan', prototype: 'prototype' };

function back(projectId: string, artifactId: string, key: 'notice' | 'error', text: string): never {
  revalidatePath('/owner', 'layout');
  redirect(
    `/owner/projects/${encodeURIComponent(projectId)}/artifacts/${encodeURIComponent(artifactId)}?${key}=${encodeURIComponent(text)}`,
  );
}

function ids(formData: FormData) {
  return {
    projectId: String(formData.get('projectId') ?? ''),
    artifactId: String(formData.get('artifactId') ?? ''),
  };
}

/**
 * The client's reply on a prototype version, typed in by the owner (P3-T06): one note per version. It reaches
 * the owner as raw text; nothing goes to the agent until the owner forwards it.
 */
export async function recordPrototypeNote(formData: FormData) {
  const { projectId, artifactId } = ids(formData);
  const user = await requireRole('owner', `/owner/projects/${projectId}`);
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return back(projectId, artifactId, 'error', 'Write what the client said.');
  if (body.length > NOTE_MAX)
    return back(projectId, artifactId, 'error', `The note can be at most ${NOTE_MAX} characters.`);
  const supabase = await createClient();
  const art = await supabase
    .from('artifacts')
    .select('type')
    .eq('id', artifactId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (art.error) throw new Error(art.error.message);
  if (art.data?.type !== 'prototype')
    return back(projectId, artifactId, 'error', 'Notes belong to a prototype version.');
  const existing = await supabase
    .from('comments')
    .select('id')
    .eq('artifact_id', artifactId)
    .eq('kind', 'prototype')
    .limit(1);
  if (existing.error) throw new Error(existing.error.message);
  if ((existing.data ?? []).length)
    return back(projectId, artifactId, 'error', 'This version already has its note.');
  const saved = await supabase.from('comments').insert({
    project_id: projectId,
    artifact_id: artifactId,
    body,
    kind: 'prototype',
    created_by: user.userId,
  });
  if (saved.error) return back(projectId, artifactId, 'error', saved.error.message);
  return back(
    projectId,
    artifactId,
    'notice',
    'Note recorded. Forward it to the agent, turn it into a change request, or dismiss it.',
  );
}

/** What the owner does with a note (P3-T06): forward to the agent (a Feedback loop), a change request, or dismiss. */
export async function actOnNote(formData: FormData) {
  const { projectId, artifactId } = ids(formData);
  await requireRole('owner', `/owner/projects/${projectId}`);
  const commentId = String(formData.get('commentId') ?? '');
  const action = String(formData.get('action') ?? '') as NoteAction;
  if (!NOTE_ACTIONS.includes(action))
    return back(projectId, artifactId, 'error', 'Choose what to do with the note.');
  const supabase = await createClient();
  const note = await supabase
    .from('comments')
    .select('id, body, owner_disposition, artifact_id')
    .eq('id', commentId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (note.error) throw new Error(note.error.message);
  if (!note.data || note.data.artifact_id !== artifactId)
    return back(projectId, artifactId, 'error', 'That note is not on this version.');
  if (note.data.owner_disposition)
    return back(projectId, artifactId, 'error', 'That note has already been handled.');
  if (action === 'forward') {
    // A Feedback loop: the database checks the cap (2 for the prototype, P3-T07) and queues the agent's revision.
    const fb = await supabase.rpc('feedback_gate', {
      p_project: projectId,
      p_artifact: artifactId,
      p_body: note.data.body,
    });
    if (fb.error) return back(projectId, artifactId, 'error', fb.error.message);
  } else if (action === 'change_request') {
    const cr = await supabase
      .from('change_requests')
      .insert({ project_id: projectId, description: note.data.body });
    if (cr.error) return back(projectId, artifactId, 'error', cr.error.message);
  }
  const done = await supabase
    .from('comments')
    .update({ owner_disposition: DISPOSITION[action] })
    .eq('id', commentId);
  if (done.error) throw new Error(done.error.message);
  return back(
    projectId,
    artifactId,
    'notice',
    action === 'forward'
      ? 'Forwarded to the agent: a revision is queued.'
      : action === 'change_request'
        ? 'Recorded as a change request: decide it on the change requests page.'
        : 'Note dismissed.',
  );
}

/** Optional good or bad marks on the skills a stage used (P3-T08); unmarked skills do not count. */
export async function saveSkillMarks(formData: FormData) {
  const { projectId, artifactId } = ids(formData);
  await requireRole('owner', `/owner/projects/${projectId}`);
  const supabase = await createClient();
  const art = await supabase
    .from('artifacts')
    .select('type, content')
    .eq('id', artifactId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (art.error) throw new Error(art.error.message);
  const stage = art.data ? STAGE_OF[art.data.type] : undefined;
  if (!art.data || !stage)
    return back(projectId, artifactId, 'error', 'Skill marks belong to a plan or a prototype.');
  const skills = skillsUsed(art.data.type, art.data.content);
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const marks = marksFromForm(values, skills);
  const cleared = await supabase
    .from('skill_uses')
    .delete()
    .eq('project_id', projectId)
    .eq('stage', stage)
    .in('skill', skills);
  if (cleared.error) throw new Error(cleared.error.message);
  if (marks.length) {
    const saved = await supabase
      .from('skill_uses')
      .insert(marks.map((m) => ({ project_id: projectId, stage, ...m })));
    if (saved.error) return back(projectId, artifactId, 'error', saved.error.message);
  }
  return back(projectId, artifactId, 'notice', `Skill marks saved (${marks.length} marked).`);
}
