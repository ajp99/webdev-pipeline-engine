// Stores reference screenshots privately (P3-T12): in the owner-only intake-uploads bucket, under the project's
// folder, as uploads rows of kind reference_screenshot, so they are deleted with the project's other data.
import type { SupabaseClient } from '@supabase/supabase-js';
import { effectiveAnswers, type Database, type LinkAnswer } from '@wpe/shared';
import type { Shot } from './reference-shots';

export const SHOT_KIND = 'reference_screenshot';
const BUCKET = 'intake-uploads';
const IMAGE_MAX = 5 * 1024 * 1024;

/** The reference sites the client listed in the intake (question reference_sites), newest answer first. */
export async function referenceUrls(
  admin: SupabaseClient<Database>,
  projectId: string,
): Promise<string[]> {
  const r = await admin
    .from('intake_responses')
    .select('round, question_id, answer')
    .eq('project_id', projectId);
  if (r.error) throw new Error(r.error.message);
  const links = effectiveAnswers(r.data ?? []).reference_sites;
  return Array.isArray(links) ? (links as LinkAnswer[]).map((l) => l.url).filter(Boolean) : [];
}

/** Replaces the project's stored reference screenshots with these. Returns the stored paths. */
export async function storeShots(
  admin: SupabaseClient<Database>,
  projectId: string,
  shots: Shot[],
): Promise<string[]> {
  const old = await admin
    .from('uploads')
    .select('id, storage_path')
    .eq('project_id', projectId)
    .eq('kind', SHOT_KIND);
  if (old.error) throw new Error(old.error.message);
  if (old.data?.length) {
    const removed = await admin.storage.from(BUCKET).remove(old.data.map((o) => o.storage_path));
    if (removed.error) throw new Error(removed.error.message);
    const del = await admin
      .from('uploads')
      .delete()
      .in(
        'id',
        old.data.map((o) => o.id),
      );
    if (del.error) throw new Error(del.error.message);
  }
  const paths: string[] = [];
  for (const [i, s] of shots.entries()) {
    if (!s.ok || s.image.length > IMAGE_MAX) continue;
    const path = `${projectId}/reference/${i + 1}-${new URL(s.url).hostname}.jpg`;
    const up = await admin.storage
      .from(BUCKET)
      .upload(path, s.image, { contentType: 'image/jpeg', upsert: true });
    if (up.error) throw new Error(up.error.message);
    const row = await admin.from('uploads').insert({
      project_id: projectId,
      kind: SHOT_KIND,
      storage_path: path,
      mime_type: 'image/jpeg',
      size_bytes: s.image.length,
      // Made by this tool from a public page, not a client file: nothing to scan.
      scan_status: 'clean',
    });
    if (row.error) throw new Error(row.error.message);
    paths.push(path);
  }
  return paths;
}
