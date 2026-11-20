// The database side of the stub stages: reads with the service key, writes only through complete_stage_artifact.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@wpe/shared';
import { assembleReviewInput } from './intake-review';
import type { StubDeps } from './stage-stubs';

export function supabaseStubDeps(admin: SupabaseClient<Database>): StubDeps {
  return {
    async loadIntake(projectId) {
      const project = await admin
        .from('projects')
        .select('name, intake_template_snapshot')
        .eq('id', projectId)
        .maybeSingle();
      if (project.error) throw new Error(project.error.message);
      if (!project.data) return null;
      const [rounds, responses, uploads] = await Promise.all([
        admin
          .from('intake_rounds')
          .select('round, status')
          .eq('project_id', projectId)
          .order('round', { ascending: false })
          .limit(1),
        admin
          .from('intake_responses')
          .select('round, question_id, answer, question')
          .eq('project_id', projectId),
        admin.from('uploads').select('kind').eq('project_id', projectId),
      ]);
      for (const r of [rounds, responses, uploads]) if (r.error) throw new Error(r.error.message);
      const latest = rounds.data?.[0];
      // Only an intake that was reviewed (and so accepted) feeds a PRD, never a round still open or in review.
      if (!latest || latest.status !== 'reviewed') return null;
      return {
        projectName: project.data.name,
        input: assembleReviewInput({
          snapshot: project.data.intake_template_snapshot,
          round: latest.round,
          responses: responses.data ?? [],
          uploadKinds: (uploads.data ?? []).map((u) => u.kind),
        }),
      };
    },

    async loadApproved(projectId, type) {
      const { data, error } = await admin
        .from('artifacts')
        .select('content')
        .eq('project_id', projectId)
        .eq('type', type)
        .eq('status', 'approved')
        .order('version', { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      return data?.[0]?.content ?? null;
    },

    async write(a) {
      const { error } = await admin.rpc('complete_stage_artifact', {
        p_project: a.project,
        p_run: a.run,
        p_worker: a.worker,
        p_type: a.type,
        p_content: a.content as unknown as Json,
        p_model: 'stub:template',
      });
      if (error) throw new Error(`complete_stage_artifact: ${error.message}`);
    },
  };
}
