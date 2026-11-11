// What the intake page reads besides the form (P2-T06): all rows for the history, the Feedback sent on the
// intake review, and why the last review failed. Reads only; the owner's session does them.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@wpe/shared';
import type { HistoryRow } from './intake-history';

type Db = SupabaseClient<Database>;

export type FeedbackNote = { id: string; body: string; createdAt: string; version: number };

export async function loadHistoryRows(supabase: Db, projectId: string): Promise<HistoryRow[]> {
  const { data, error } = await supabase
    .from('intake_responses')
    .select('round, question_id, answer, asked_by, question')
    .eq('project_id', projectId);
  if (error) throw new Error(error.message);
  return data;
}

/**
 * The Feedback the owner sent on the intake review, oldest first, with the version it was sent on, and the
 * newest version number. Feedback on the newest version has not been read by a review yet.
 */
export async function loadIntakeFeedback(
  supabase: Db,
  projectId: string,
): Promise<{ notes: FeedbackNote[]; latestVersion: number }> {
  const [fb, latest] = await Promise.all([
    supabase
      .from('gate_feedback')
      .select('id, body, created_at, artifacts!inner(type, version)')
      .eq('project_id', projectId)
      .eq('artifacts.type', 'intake_record')
      .order('created_at'),
    supabase
      .from('artifacts')
      .select('version')
      .eq('project_id', projectId)
      .eq('type', 'intake_record')
      .order('version', { ascending: false })
      .limit(1),
  ]);
  if (fb.error) throw new Error(fb.error.message);
  if (latest.error) throw new Error(latest.error.message);
  return {
    notes: fb.data.map((f) => ({
      id: f.id,
      body: f.body,
      createdAt: f.created_at,
      version: f.artifacts.version,
    })),
    latestVersion: latest.data[0]?.version ?? 0,
  };
}

/**
 * Why the newest intake run failed: the last error line of its log, cut to 300 characters. Null when the
 * newest run did not fail or left no error line. Log text is shown as plain text only.
 */
export async function loadReviewFailure(supabase: Db, projectId: string): Promise<string | null> {
  const run = await supabase
    .from('stage_runs')
    .select('id, status')
    .eq('project_id', projectId)
    .eq('stage', 'intake')
    .order('queued_at', { ascending: false })
    .limit(1);
  if (run.error) throw new Error(run.error.message);
  const last = run.data[0];
  if (!last || last.status !== 'failed') return null;
  const log = await supabase
    .from('run_logs')
    .select('message')
    .eq('run_id', last.id)
    .eq('level', 'error')
    .order('id', { ascending: false })
    .limit(1);
  if (log.error) throw new Error(log.error.message);
  const msg = log.data[0]?.message;
  return msg ? (msg.length > 300 ? `${msg.slice(0, 300)}…` : msg) : null;
}
