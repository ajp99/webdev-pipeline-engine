// The database side of the Planner: reads with the service key, writes only through complete_stage_artifact.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  asPrd,
  capNotes,
  intakeData,
  planProblem,
  type Database,
  type Json,
  type LinkAnswer,
  type Plan,
  type PlannerInput,
} from '@wpe/shared';
import { assembleReviewInput } from './intake-review';
import type { PlannerDeps } from './planner';
import type { RegistryRow } from './skills';
import type { Skill } from '@wpe/shared';

export type PlannerRows = {
  project: {
    name: string;
    status: string;
    stage: string;
    intake_template_snapshot: unknown;
  } | null;
  responses: { round: number; question_id: string; answer: unknown; question?: string | null }[];
  prd: unknown;
  newestPlan: { id: string; content: unknown } | null;
  feedback: { artifact_id: string; body: string }[];
  notes: string[];
  skills: Skill[];
  library: RegistryRow[];
};

/** Skills a plan may select: in the library and not deployment or handover (those are not build skills). */
export function plannableSkills(skills: Skill[], library: RegistryRow[]) {
  const listed = new Set(library.filter((r) => r.scope === 'library').map((r) => r.name));
  return skills
    .filter((s) => listed.has(s.id) && !/^(deployment|handover)\//.test(s.id))
    .map((s) => ({ id: s.id, description: s.description }));
}

export function assemblePlannerInput(rows: PlannerRows): PlannerInput | null {
  const p = rows.project;
  if (!p || p.status !== 'active' || p.stage !== 'plan') return null;
  const prd = asPrd(rows.prd);
  if (!prd) throw new Error('there is no approved PRD in the PRD shape to plan from');
  const intake = assembleReviewInput({
    snapshot: p.intake_template_snapshot,
    round: 0,
    responses: rows.responses,
    uploadKinds: [],
  });
  const data = intakeData(intake);
  const design: Record<string, string | string[]> = {};
  for (const s of data.sections.filter((x) => /design|brand|look/i.test(x.title)))
    for (const q of s.questions)
      if (q.answer !== null) design[q.question] = q.answer as string | string[];
  const links = intake.answers.reference_sites;
  const references = Array.isArray(links)
    ? (links as LinkAnswer[]).map((l) => ({ url: l.url, ...(l.note ? { note: l.note } : {}) }))
    : [];
  // The stored plan may carry the model's name; the Planner revises the plan itself.
  const stored = rows.newestPlan?.content;
  const previous: Plan | null =
    stored && planProblem(stored) === null
      ? (Object.fromEntries(
          Object.entries(stored as Record<string, unknown>).filter(([k]) => k !== 'model'),
        ) as Plan)
      : null;
  return {
    projectName: p.name,
    prd: {
      sections: prd.sections,
      spam_protection: prd.spam_protection,
      change_summary: prd.change_summary,
    },
    design,
    references,
    skills: plannableSkills(rows.skills, rows.library),
    ownerNotes: capNotes(rows.notes),
    previous,
    ownerFeedback: rows.feedback
      .filter((f) => f.artifact_id === rows.newestPlan?.id)
      .map((f) => f.body.trim())
      .filter(Boolean),
  };
}

export function supabasePlannerDeps(
  admin: SupabaseClient<Database>,
  skills: () => { skills: Skill[]; library: () => Promise<RegistryRow[]> },
): PlannerDeps {
  return {
    async load(projectId) {
      const project = await admin
        .from('projects')
        .select('name, status, stage, intake_template_snapshot')
        .eq('id', projectId)
        .maybeSingle();
      if (project.error) throw new Error(project.error.message);
      if (!project.data || project.data.stage !== 'plan') return null;
      const lib = skills();
      const [responses, prd, plan, feedback, notes, library] = await Promise.all([
        admin
          .from('intake_responses')
          .select('round, question_id, answer, question')
          .eq('project_id', projectId),
        admin
          .from('artifacts')
          .select('content')
          .eq('project_id', projectId)
          .eq('type', 'prd')
          .eq('status', 'approved')
          .order('version', { ascending: false })
          .limit(1),
        admin
          .from('artifacts')
          .select('id, content')
          .eq('project_id', projectId)
          .eq('type', 'plan')
          .order('version', { ascending: false })
          .limit(1),
        admin
          .from('gate_feedback')
          .select('artifact_id, body')
          .eq('project_id', projectId)
          .order('created_at'),
        admin
          .from('owner_notes')
          .select('body')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        lib.library(),
      ]);
      for (const r of [responses, prd, plan, feedback, notes])
        if (r.error) throw new Error(r.error.message);
      return assemblePlannerInput({
        project: project.data,
        responses: responses.data ?? [],
        prd: prd.data?.[0]?.content ?? null,
        newestPlan: plan.data?.[0] ?? null,
        feedback: feedback.data ?? [],
        notes: (notes.data ?? []).map((n) => n.body),
        skills: lib.skills,
        library,
      });
    },

    async write(a) {
      const { error } = await admin.rpc('complete_stage_artifact', {
        p_project: a.project,
        p_run: a.run,
        p_worker: a.worker,
        p_type: 'plan',
        p_content: a.plan as unknown as Json,
        p_model: a.model,
        p_prompt_hash: a.promptHash,
      });
      if (error) throw new Error(`complete_stage_artifact: ${error.message}`);
    },
  };
}
