// The Supabase side of the intake store (P2-T03). The owner's session does the writes; row-level
// security lets only the owner touch these tables.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  effectiveAnswers,
  parseReviewRecord,
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

    async effectiveAnswers(projectId) {
      const { data, error } = await supabase
        .from('intake_responses')
        .select('round, question_id, answer')
        .eq('project_id', projectId);
      if (error) throw new Error(error.message);
      return effectiveAnswers(data);
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
        // In a later round, clearing an answer an earlier round gave must hide it: the newest row wins,
        // so leave an empty one behind.
        if (round > 1) {
          const { data, error: e2 } = await supabase
            .from('intake_responses')
            .select('question_id')
            .eq('project_id', projectId)
            .lt('round', round)
            .in('question_id', drop);
          if (e2) throw new Error(e2.message);
          const hidden = [...new Set(data.map((r) => r.question_id))];
          if (hidden.length > 0) {
            const { error: e3 } = await supabase.from('intake_responses').upsert(
              hidden.map((question_id) => ({
                project_id: projectId,
                round,
                question_id,
                answer: null,
                asked_by: 'template' as const,
                updated_at: new Date().toISOString(),
              })),
              { onConflict: 'project_id,round,question_id' },
            );
            if (e3) throw new Error(e3.message);
          }
        }
      }
    },

    async saveFollowupAnswers(projectId, round, answers) {
      // The question rows exist since the review saved them (P2-T06), so an answer is an update, and an
      // emptied answer is set back to null: deleting the row would remove the question.
      for (const [question_id, answer] of Object.entries(answers)) {
        const { data, error } = await supabase
          .from('intake_responses')
          .update({ answer: answer as never, updated_at: new Date().toISOString() })
          .eq('project_id', projectId)
          .eq('round', round)
          .eq('question_id', question_id)
          .select('question_id');
        if (error) throw new Error(error.message);
        // No row means the question was removed (or never saved): do not report "Saved" for a lost answer.
        if (data.length === 0)
          throw new Error('This question no longer exists in the round. Reload the page.');
      }
    },

    async followupRows(projectId, round) {
      const { data, error } = await supabase
        .from('intake_responses')
        .select('question_id, question, asked_by')
        .eq('project_id', projectId)
        .eq('round', round)
        .neq('asked_by', 'template');
      if (error) throw new Error(error.message);
      return data
        .map((r) => ({
          id: r.question_id,
          text: r.question ?? '',
          askedBy: r.asked_by === 'owner' ? ('owner' as const) : ('agent' as const),
        }))
        .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
    },

    async addQuestion(projectId, round, text) {
      // The next free number: the highest ow<round>_<n> in the round plus one.
      const { data, error } = await supabase
        .from('intake_responses')
        .select('question_id')
        .eq('project_id', projectId)
        .eq('round', round)
        .eq('asked_by', 'owner');
      if (error) throw new Error(error.message);
      const used = data.map((r) => Number(r.question_id.split('_')[1] ?? 0));
      const id = `ow${round}_${Math.max(0, ...used) + 1}`;
      const ins = await supabase.from('intake_responses').insert({
        project_id: projectId,
        round,
        question_id: id,
        question: text,
        answer: null,
        asked_by: 'owner',
      });
      if (ins.error) throw new Error(ins.error.message);
      return id;
    },

    async removeQuestion(projectId, round, questionId) {
      const { data, error } = await supabase
        .from('intake_responses')
        .delete()
        .eq('project_id', projectId)
        .eq('round', round)
        .eq('question_id', questionId)
        .neq('asked_by', 'template')
        .select('question_id');
      if (error) throw new Error(error.message);
      return data.length > 0;
    },

    async latestReview(projectId) {
      const { data, error } = await supabase
        .from('artifacts')
        .select('content')
        .eq('project_id', projectId)
        .eq('type', 'intake_record')
        .order('version', { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      return data[0] ? parseReviewRecord(data[0].content) : null;
    },

    async reviewRunActive(projectId) {
      const { data, error } = await supabase
        .from('stage_runs')
        .select('id')
        .eq('project_id', projectId)
        .eq('stage', 'intake')
        .in('status', ['queued', 'running', 'waiting', 'cancel_requested'])
        .limit(1);
      if (error) throw new Error(error.message);
      return data.length > 0;
    },

    async lastReviewStatus(projectId) {
      const { data, error } = await supabase
        .from('stage_runs')
        .select('status')
        .eq('project_id', projectId)
        .eq('stage', 'intake')
        .order('queued_at', { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      return data[0]?.status ?? null;
    },

    async enqueueReview(projectId) {
      const { error } = await supabase.rpc('enqueue_run', {
        p_project: projectId,
        p_stage: 'intake',
      });
      if (error) throw new Error(error.message);
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
