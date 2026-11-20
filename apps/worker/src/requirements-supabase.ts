// The database side of the requirements agent: reads with the service key, writes only through
// complete_stage_artifact. It never reads prd_feedback (the client's notes go to the owner, D-087); the owner's
// Feedback on the newest PRD (gate_feedback, P2-T19) is what a Feedback-queued revision must apply.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  asPrd,
  capNotes,
  parseReviewRecord,
  type Database,
  type Json,
  type RequirementsInput,
} from '@wpe/shared';
import { assembleReviewInput, type ReviewRows } from './intake-review';
import type { RequirementsDeps } from './requirements';

export type RequirementsRows = {
  project: {
    name: string;
    status: string;
    stage: string;
    intake_template_snapshot: unknown;
  } | null;
  responses: ReviewRows['responses'];
  uploadKinds: string[];
  /** The owner's notes, newest first. */
  notes: string[];
  /** The newest approved intake_record's content, if any. */
  review: unknown;
  /** The newest PRD version, if any. */
  newestPrd: { id: string; content: unknown } | null;
  /** gate_feedback rows (artifact id and body), oldest first. */
  feedback: { artifact_id: string; body: string }[];
};

/** What the agent reads, from the rows; null when the project is not at an active requirements stage. */
export function assembleRequirementsInput(rows: RequirementsRows): RequirementsInput | null {
  const p = rows.project;
  if (!p || p.status !== 'active' || p.stage !== 'requirements') return null;
  const intake = assembleReviewInput({
    snapshot: p.intake_template_snapshot,
    round: 0,
    responses: rows.responses,
    uploadKinds: rows.uploadKinds,
  });
  const record = rows.review ? parseReviewRecord(rows.review) : null;
  const previous = rows.newestPrd ? asPrd(rows.newestPrd.content) : null;
  if (rows.newestPrd && !previous)
    throw new Error('the newest PRD version is not in the PRD shape; save a valid version first');
  const newestId = rows.newestPrd?.id;
  return {
    projectName: p.name,
    intake,
    review: record ? { summary: record.summary, gaps: record.gaps.map((g) => g.issue) } : null,
    ownerNotes: capNotes(rows.notes),
    // The stored version may carry the model's name; the agent revises the content only.
    previous: previous
      ? {
          sections: previous.sections,
          spam_protection: previous.spam_protection,
          change_summary: previous.change_summary,
        }
      : null,
    // Only the Feedback on the version being revised: older Feedback was applied by an earlier revision.
    ownerFeedback: rows.feedback
      .filter((f) => f.artifact_id === newestId)
      .map((f) => f.body.trim())
      .filter((b) => b !== ''),
  };
}

export function supabaseRequirementsDeps(admin: SupabaseClient<Database>): RequirementsDeps {
  return {
    async load(projectId) {
      const project = await admin
        .from('projects')
        .select('name, status, stage, intake_template_snapshot')
        .eq('id', projectId)
        .maybeSingle();
      if (project.error) throw new Error(project.error.message);
      if (!project.data || project.data.stage !== 'requirements') return null;

      const [responses, uploads, notes, review, prd, feedback] = await Promise.all([
        admin
          .from('intake_responses')
          .select('round, question_id, answer, question')
          .eq('project_id', projectId),
        admin.from('uploads').select('kind').eq('project_id', projectId),
        admin
          .from('owner_notes')
          .select('body')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        admin
          .from('artifacts')
          .select('content')
          .eq('project_id', projectId)
          .eq('type', 'intake_record')
          .eq('status', 'approved')
          .order('version', { ascending: false })
          .limit(1),
        admin
          .from('artifacts')
          .select('id, content')
          .eq('project_id', projectId)
          .eq('type', 'prd')
          .order('version', { ascending: false })
          .limit(1),
        admin
          .from('gate_feedback')
          .select('artifact_id, body')
          .eq('project_id', projectId)
          .order('created_at'),
      ]);
      for (const r of [responses, uploads, notes, review, prd, feedback])
        if (r.error) throw new Error(r.error.message);
      return assembleRequirementsInput({
        project: project.data,
        responses: responses.data ?? [],
        uploadKinds: (uploads.data ?? []).map((u) => u.kind),
        notes: (notes.data ?? []).map((n) => n.body),
        review: review.data?.[0]?.content ?? null,
        newestPrd: prd.data?.[0] ?? null,
        feedback: feedback.data ?? [],
      });
    },

    async write(a) {
      const { error } = await admin.rpc('complete_stage_artifact', {
        p_project: a.project,
        p_run: a.run,
        p_worker: a.worker,
        p_type: 'prd',
        p_content: a.content as unknown as Json,
        p_model: a.model,
        p_notes: a.notes as unknown as Json,
      });
      if (error) throw new Error(`complete_stage_artifact: ${error.message}`);
    },
  };
}
