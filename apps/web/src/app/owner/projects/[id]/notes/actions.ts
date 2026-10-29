'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { noteProblem } from '@/lib/notes';
import { createClient } from '@/lib/supabase/server';

async function context(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  await requireRole('owner', `/owner/projects/${projectId}/notes`);
  return { projectId, supabase: await createClient() };
}

function back(projectId: string, key: 'notice' | 'error', text: string): never {
  revalidatePath(`/owner/projects/${projectId}/notes`);
  redirect(`/owner/projects/${projectId}/notes?${key}=${encodeURIComponent(text)}`);
}

export async function addNoteAction(formData: FormData) {
  const { projectId, supabase } = await context(formData);
  const body = String(formData.get('body') ?? '').trim();
  const problem = noteProblem(body);
  if (problem) back(projectId, 'error', problem);
  const { error } = await supabase.from('owner_notes').insert({ project_id: projectId, body });
  if (error) throw new Error(error.message);
  back(projectId, 'notice', 'Note added');
}

export async function saveNoteAction(formData: FormData) {
  const { projectId, supabase } = await context(formData);
  const noteId = String(formData.get('noteId') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  const problem = noteProblem(body);
  if (problem) back(projectId, 'error', problem);
  const { data, error } = await supabase
    .from('owner_notes')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('id', noteId)
    .eq('project_id', projectId)
    .select('id');
  if (error) throw new Error(error.message);
  if (data.length === 0) back(projectId, 'error', 'That note is already gone. Reload the page.');
  back(projectId, 'notice', 'Note saved');
}

export async function deleteNoteAction(formData: FormData) {
  const { projectId, supabase } = await context(formData);
  const noteId = String(formData.get('noteId') ?? '');
  const { error } = await supabase
    .from('owner_notes')
    .delete()
    .eq('id', noteId)
    .eq('project_id', projectId);
  if (error) throw new Error(error.message);
  back(projectId, 'notice', 'Note deleted');
}
