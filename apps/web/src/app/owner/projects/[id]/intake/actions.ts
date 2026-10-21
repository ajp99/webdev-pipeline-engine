'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import {
  canChangeFiles,
  reopenRound,
  saveSection,
  submitRound,
  unlockRound,
  type Outcome,
} from '@/lib/intake-core';
import { checkUpload } from '@/lib/intake-form';
import { loadProjectTemplate, supabaseIntakeStore } from '@/lib/intake-store';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'intake-uploads';

function done(projectId: string, section: string | null, outcome: Outcome): never {
  revalidatePath(`/owner/projects/${projectId}/intake`);
  const q = new URLSearchParams();
  if (section) q.set('section', section);
  if (outcome.ok) {
    if (outcome.notice) q.set('notice', outcome.notice);
  } else q.set('error', outcome.message);
  redirect(`/owner/projects/${projectId}/intake?${q.toString()}`);
}

async function context(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  await requireRole('owner', `/owner/projects/${projectId}/intake`);
  const supabase = await createClient();
  const project = await loadProjectTemplate(supabase, projectId);
  if (!project) redirect('/owner');
  return {
    projectId,
    section: String(formData.get('section') ?? '') || null,
    supabase,
    store: supabaseIntakeStore(supabase),
    template: project.template,
  };
}

export async function saveSectionAction(formData: FormData) {
  const c = await context(formData);
  const outcome = await saveSection(c.store, c.template, c.projectId, c.section ?? '', {
    get: (n) => {
      const v = formData.get(n);
      return typeof v === 'string' ? v : null;
    },
    getAll: (n) => formData.getAll(n).filter((v): v is string => typeof v === 'string'),
  });
  done(c.projectId, c.section, outcome);
}

export async function submitRoundAction(formData: FormData) {
  const c = await context(formData);
  done(c.projectId, c.section, await submitRound(c.store, c.template, c.projectId));
}

export async function reopenRoundAction(formData: FormData) {
  const c = await context(formData);
  done(c.projectId, c.section, await reopenRound(c.store, c.projectId));
}

export async function unlockRoundAction(formData: FormData) {
  const c = await context(formData);
  done(c.projectId, c.section, await unlockRound(c.store, c.projectId));
}

export async function uploadFileAction(formData: FormData) {
  const c = await context(formData);
  const questionId = String(formData.get('questionId') ?? '');
  const file = formData.get('file');
  const question = c.template.sections.flatMap((s) => s.questions).find((q) => q.id === questionId);
  if (!question) return done(c.projectId, c.section, { ok: false, message: 'unknown question' });
  if (!(file instanceof File) || file.size === 0)
    return done(c.projectId, c.section, { ok: false, message: 'choose a file first' });

  const open = await canChangeFiles(c.store, c.projectId);
  if (!open.ok) return done(c.projectId, c.section, open);
  const counts = await c.store.uploadCounts(c.projectId);
  const check = checkUpload(question, file, counts[questionId] ?? 0);
  if (!check.ok)
    return done(c.projectId, c.section, {
      ok: false,
      message: `${question.label}: ${check.message}`,
    });

  const path = `${c.projectId}/${questionId}/${crypto.randomUUID()}-${check.safeName}`;
  const stored = await c.supabase.storage.from(BUCKET).upload(path, file, {
    contentType: check.mime,
    upsert: false,
  });
  if (stored.error) throw new Error(stored.error.message);
  const row = await c.supabase.from('uploads').insert({
    project_id: c.projectId,
    kind: questionId,
    storage_path: path,
    mime_type: check.mime,
    size_bytes: file.size,
    optional: !question.required,
  });
  if (row.error) {
    // No file without its row: it would be invisible and never cleaned up.
    await c.supabase.storage.from(BUCKET).remove([path]);
    throw new Error(row.error.message);
  }
  done(c.projectId, c.section, { ok: true, notice: 'File added' });
}

export async function removeUploadAction(formData: FormData) {
  const c = await context(formData);
  const uploadId = String(formData.get('uploadId') ?? '');
  const open = await canChangeFiles(c.store, c.projectId);
  if (!open.ok) return done(c.projectId, c.section, open);
  const { data, error } = await c.supabase
    .from('uploads')
    .select('storage_path')
    .eq('id', uploadId)
    .eq('project_id', c.projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data)
    return done(c.projectId, c.section, { ok: false, message: 'that file is already gone' });
  // The row first, so a failed storage delete leaves an orphan object, not a row pointing at nothing.
  const del = await c.supabase.from('uploads').delete().eq('id', uploadId);
  if (del.error) throw new Error(del.error.message);
  await c.supabase.storage.from(BUCKET).remove([data.storage_path]);
  done(c.projectId, c.section, { ok: true, notice: 'File removed' });
}
