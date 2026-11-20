// The database side of the requirements agent: reads with the service key, writes only through
// complete_stage_artifact. It never reads prd_feedback (the client's notes go to the owner, D-087).
import type { SupabaseClient } from '@supabase/supabase-js';
import { asPrd, capNotes, parseReviewRecord, type Database, type Json } from '@wpe/shared';
import { assembleReviewInput } from './intake-review';
import type { RequirementsDeps } from './requirements';

export function supabaseRequirementsDeps(admin: SupabaseClient<Database>): RequirementsDeps {
  return {
    async load(projectId) {
      const project = await admin
        .from('projects')
        .select('name, status, stage, intake_template_snapshot')
        .eq('id', projectId)
        .maybeSingle();
      if (project.error) throw new Error(project.error.message);
      if (
        !project.data ||
        project.data.status !== 'active' ||
        project.data.stage !== 'requirements'
      )
        return null;

      const [responses, uploads, notes, review, prd] = await Promise.all([
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
          .select('content')
          .eq('project_id', projectId)
          .eq('type', 'prd')
          .order('version', { ascending: false })
          .limit(1),
      ]);
      for (const r of [responses, uploads, notes, review, prd])
        if (r.error) throw new Error(r.error.message);

      const intake = assembleReviewInput({
        snapshot: project.data.intake_template_snapshot,
        round: 0,
        responses: responses.data ?? [],
        uploadKinds: (uploads.data ?? []).map((u) => u.kind),
      });
      const record = review.data?.[0] ? parseReviewRecord(review.data[0].content) : null;
      const newest = prd.data?.[0]?.content;
      const previous = newest === undefined ? null : asPrd(newest);
      if (newest !== undefined && !previous)
        throw new Error(
          'the newest PRD version is not in the PRD shape; save a valid version first',
        );
      return {
        projectName: project.data.name,
        intake,
        review: record ? { summary: record.summary, gaps: record.gaps.map((g) => g.issue) } : null,
        ownerNotes: capNotes((notes.data ?? []).map((n) => n.body)),
        // The stored version may carry the model's name; the agent revises the content only.
        previous: previous
          ? {
              sections: previous.sections,
              spam_protection: previous.spam_protection,
              change_summary: previous.change_summary,
            }
          : null,
      };
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
