// The database side of the Prototype run: reads with the service key; screenshots go to the owner-only bucket
// under the project's folder (uploads of kind prototype_screenshot), and the artifact only through
// complete_stage_artifact.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { asPrd, planProblem, type Database, type Json, type Plan, type Skill } from '@wpe/shared';
import type { PrototypeDeps, PrototypeInput } from './prototype';
import { PROTOTYPE_AREAS } from './prototype';
import { loadSelected, type RegistryRow } from './skills';

const BUCKET = 'intake-uploads';
export const PROTOTYPE_SHOT_KIND = 'prototype_screenshot';
const IMAGE_MAX = 5 * 1024 * 1024;

export type PrototypeRows = {
  project: { status: string; stage: string } | null;
  prd: unknown;
  plan: unknown;
  newest: { id: string; version: number; content: unknown } | null;
  feedback: { artifact_id: string; body: string }[];
  skills: Skill[];
  library: RegistryRow[];
};

/** The plan's skills that bear on the prototype, loaded only if the registry lists them (D-282). */
export function prototypeSkills(plan: Plan, skills: Skill[], library: RegistryRow[]): Skill[] {
  const ids = [...new Set(plan.rounds.flatMap((r) => r.skills))].filter((id) =>
    PROTOTYPE_AREAS.includes(id.split('/')[0]!),
  );
  return loadSelected(ids, skills, library);
}

export function assemblePrototypeInput(rows: PrototypeRows): PrototypeInput | null {
  const p = rows.project;
  if (!p || p.status !== 'active' || p.stage !== 'prototype') return null;
  const prd = asPrd(rows.prd);
  if (!prd) throw new Error('there is no approved PRD to build the prototype from');
  if (planProblem(rows.plan) !== null)
    throw new Error('there is no approved plan to build the prototype from');
  const { model: _drop, ...plan } = rows.plan as Plan & { model?: string };
  const summary = (rows.newest?.content as { summary?: unknown } | null)?.summary;
  return {
    prd: {
      sections: prd.sections,
      spam_protection: prd.spam_protection,
      change_summary: prd.change_summary,
    },
    plan,
    skills: prototypeSkills(plan, rows.skills, rows.library),
    version: (rows.newest?.version ?? 0) + 1,
    previous: rows.newest
      ? { summary: typeof summary === 'string' ? summary : 'No summary recorded.' }
      : null,
    feedback: rows.feedback
      .filter((f) => f.artifact_id === rows.newest?.id)
      .map((f) => f.body.trim())
      .filter(Boolean),
  };
}

/** How many <Claim> markers the main page carries (the client confirms each before launch). */
export async function countClaims(dir: string): Promise<number> {
  const text = await readFile(join(dir, 'content', 'pages', 'home.mdx'), 'utf8').catch(() => '');
  return (text.match(/<Claim[\s>]/g) ?? []).length;
}

export function supabasePrototypeDeps(
  admin: SupabaseClient<Database>,
  skills: () => { skills: Skill[]; library: () => Promise<RegistryRow[]> },
): Pick<PrototypeDeps, 'load' | 'store' | 'write' | 'claims'> {
  const newestOf = (projectId: string, type: 'prd' | 'plan') =>
    admin
      .from('artifacts')
      .select('content')
      .eq('project_id', projectId)
      .eq('type', type)
      .eq('status', 'approved')
      .order('version', { ascending: false })
      .limit(1);
  return {
    async load(projectId) {
      const project = await admin
        .from('projects')
        .select('status, stage')
        .eq('id', projectId)
        .maybeSingle();
      if (project.error) throw new Error(project.error.message);
      if (!project.data || project.data.stage !== 'prototype') return null;
      const lib = skills();
      const [prd, plan, newest, feedback, library] = await Promise.all([
        newestOf(projectId, 'prd'),
        newestOf(projectId, 'plan'),
        admin
          .from('artifacts')
          .select('id, version, content')
          .eq('project_id', projectId)
          .eq('type', 'prototype')
          .order('version', { ascending: false })
          .limit(1),
        admin
          .from('gate_feedback')
          .select('artifact_id, body')
          .eq('project_id', projectId)
          .order('created_at'),
        lib.library(),
      ]);
      for (const r of [prd, plan, newest, feedback]) if (r.error) throw new Error(r.error.message);
      return assemblePrototypeInput({
        project: project.data,
        prd: prd.data?.[0]?.content ?? null,
        plan: plan.data?.[0]?.content ?? null,
        newest: newest.data?.[0] ?? null,
        feedback: feedback.data ?? [],
        skills: lib.skills,
        library,
      });
    },

    claims: countClaims,

    async store(projectId, version, screens) {
      const out = { desktop: '', mobile: '' };
      for (const k of ['desktop', 'mobile'] as const) {
        const image = screens[k];
        if (image.length > IMAGE_MAX) throw new Error(`the ${k} screenshot is over 5 MB`);
        const path = `${projectId}/prototype/v${version}-${k}.jpg`;
        const up = await admin.storage
          .from(BUCKET)
          .upload(path, image, { contentType: 'image/jpeg', upsert: true });
        if (up.error) throw new Error(up.error.message);
        await admin.from('uploads').delete().eq('project_id', projectId).eq('storage_path', path);
        const row = await admin.from('uploads').insert({
          project_id: projectId,
          kind: PROTOTYPE_SHOT_KIND,
          storage_path: path,
          mime_type: 'image/jpeg',
          size_bytes: image.length,
          // Taken by this worker from the local preview, not a client file: nothing to scan.
          scan_status: 'clean',
        });
        if (row.error) throw new Error(row.error.message);
        out[k] = path;
      }
      return out;
    },

    async write(a) {
      const { error } = await admin.rpc('complete_stage_artifact', {
        p_project: a.project,
        p_run: a.run,
        p_worker: a.worker,
        p_type: 'prototype',
        p_content: a.content as unknown as Json,
        p_model: a.model,
        p_prompt_hash: a.promptHash,
      });
      if (error) throw new Error(`complete_stage_artifact: ${error.message}`);
    },
  };
}
