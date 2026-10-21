// The Supabase side of the intake store (P2-T03). The owner's session does the writes; row-level
// security lets only the owner touch these tables.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  validateTemplate,
  type Answers,
  type Database,
  type IntakeTemplate,
  type RoundStatus,
  type UploadCounts,
} from '@wpe/shared';
import type { IntakeStore } from './intake-core';

type Db = SupabaseClient<Database>;

export function supabaseIntakeStore(supabase: Db): IntakeStore {
  return {
    async latestRound(projectId) {
      const { data, error } = await supabase
        .from('intake_rounds')
        .select('round, status')
        .eq('project_id', projectId)
        .order('round', { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      const row = data[0];
      return row ? { round: row.round, status: row.status } : null;
    },

    async answers(projectId, round) {
      const { data, error } = await supabase
        .from('intake_responses')
        .select('question_id, answer')
        .eq('project_id', projectId)
        .eq('round', round);
      if (error) throw new Error(error.message);
      const out: Answers = {};
      for (const r of data) out[r.question_id] = r.answer as Answers[string];
      return out;
    },

    async uploadCounts(projectId) {
      const { data, error } = await supabase
        .from('uploads')
        .select('kind')
        .eq('project_id', projectId);
      if (error) throw new Error(error.message);
      const out: UploadCounts = {};
      for (const u of data) out[u.kind] = (out[u.kind] ?? 0) + 1;
      return out;
    },

    async saveAnswers(projectId, round, answers) {
      const keep = Object.entries(answers).filter(([, v]) => v !== null && v !== undefined);
      const drop = Object.entries(answers)
        .filter(([, v]) => v === null || v === undefined)
        .map(([id]) => id);
      if (keep.length > 0) {
        const { error } = await supabase.from('intake_responses').upsert(
          keep.map(([question_id, answer]) => ({
            project_id: projectId,
            round,
            question_id,
            answer: answer as never,
            asked_by: 'template' as const,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'project_id,round,question_id' },
        );
        if (error) throw new Error(error.message);
      }
      if (drop.length > 0) {
        const { error } = await supabase
          .from('intake_responses')
          .delete()
          .eq('project_id', projectId)
          .eq('round', round)
          .in('question_id', drop);
        if (error) throw new Error(error.message);
      }
    },

    async moveRound(projectId, round, from: RoundStatus, to: RoundStatus) {
      const now = new Date().toISOString();
      // Compare-and-set: only a round still in `from` moves, so two clicks or the agent cannot clash.
      const patch: Database['public']['Tables']['intake_rounds']['Update'] = { status: to };
      if (to === 'submitted') patch.submitted_at = now;
      if (to === 'open') {
        patch.submitted_at = null;
        patch.reviewed_at = null;
      }
      const { data, error } = await supabase
        .from('intake_rounds')
        .update(patch)
        .eq('project_id', projectId)
        .eq('round', round)
        .eq('status', from)
        .select('id');
      if (error) throw new Error(error.message);
      return data.length > 0;
    },
  };
}

/** The template the project started with (D-061), checked again on every read. */
export async function loadProjectTemplate(
  supabase: Db,
  projectId: string,
): Promise<{ name: string; stage: string; status: string; template: IntakeTemplate } | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('name, stage, status, intake_template_snapshot')
    .eq('id', projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const check = validateTemplate(data.intake_template_snapshot);
  if (!check.ok) throw new Error(`the project's intake template is not valid: ${check.errors[0]}`);
  return { name: data.name, stage: data.stage, status: data.status, template: check.template };
}
