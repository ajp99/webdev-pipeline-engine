// The database side of the intake review: reads with the service key, writes only through
// complete_intake_review. Thin on purpose; the logic is in intake-review.ts and @wpe/shared.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@wpe/shared';
import { assembleReviewInput, type ReviewDeps } from './intake-review';

export function supabaseReviewDeps(admin: SupabaseClient<Database>): ReviewDeps {
  return {
    async load(projectId) {
      const project = await admin
        .from('projects')
        .select('status, stage, intake_template_snapshot')
        .eq('id', projectId)
        .maybeSingle();
      if (project.error) throw new Error(project.error.message);
      if (!project.data || project.data.status !== 'active' || project.data.stage !== 'intake')
        return null;

      const rounds = await admin
        .from('intake_rounds')
        .select('round, status')
        .eq('project_id', projectId)
        .order('round', { ascending: false })
        .limit(1);
      if (rounds.error) throw new Error(rounds.error.message);
      const latest = rounds.data[0];
      if (!latest || latest.status !== 'submitted') return null;

      const [responses, uploads, artifacts] = await Promise.all([
        admin
          .from('intake_responses')
          .select('round, question_id, answer')
          .eq('project_id', projectId),
        admin.from('uploads').select('kind').eq('project_id', projectId),
        admin
          .from('artifacts')
          .select('content')
          .eq('project_id', projectId)
          .eq('type', 'intake_record')
          .order('version'),
      ]);
      for (const r of [responses, uploads, artifacts])
        if (r.error) throw new Error(r.error.message);
      return assembleReviewInput({
        snapshot: project.data.intake_template_snapshot,
        round: latest.round,
        responses: responses.data ?? [],
        uploadKinds: (uploads.data ?? []).map((u) => u.kind),
        artifacts: (artifacts.data ?? []).map((a) => a.content),
      });
    },

    async complete(projectId, round, c, model) {
      const { error } = await admin.rpc('complete_intake_review', {
        p_project: projectId,
        p_round: round,
        p_summary: c.summary,
        p_gaps: c.gaps as unknown as Json,
        p_followups: c.followups as unknown as Json,
        p_model: model,
      });
      if (error) throw new Error(`complete_intake_review: ${error.message}`);
    },
  };
}
