import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, QueueInput } from '@wpe/shared';

/** Reads what the queue needs. Row-level security lets the owner read everything here. */
export async function loadQueueInput(supabase: SupabaseClient<Database>): Promise<QueueInput> {
  const [projects, gateConfig, artifacts, approvals, rounds] = await Promise.all([
    supabase.from('projects').select('id, name, stage, status').order('created_at'),
    supabase
      .from('gate_config')
      .select('stage, project_id, gate_type, gatekeeper, escalate_after_hours'),
    supabase
      .from('artifacts')
      .select('id, project_id, type, version, status, created_at, round:content->round'),
    supabase.from('approvals').select('artifact_id, gate_type, at'),
    supabase.from('rounds').select('project_id, number, status'),
  ]);
  for (const r of [projects, gateConfig, artifacts, approvals, rounds]) {
    if (r.error) throw new Error(r.error.message);
  }
  return {
    now: new Date(),
    projects: projects.data ?? [],
    gateConfig: gateConfig.data ?? [],
    artifacts: (artifacts.data ?? []).map((a) => ({
      ...a,
      round: typeof a.round === 'number' ? a.round : null,
    })),
    approvals: approvals.data ?? [],
    rounds: rounds.data ?? [],
  };
}
