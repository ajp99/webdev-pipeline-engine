import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, GateRow, QueueInput } from '@wpe/shared';

/**
 * Reads what the queue needs. The gates come from remaining_gates() (D-239, D-261): the database decides
 * which gate is missing, blocked or satisfied and whether a project is ready to advance.
 */
export async function loadQueueInput(supabase: SupabaseClient<Database>): Promise<QueueInput> {
  const [projects, gates] = await Promise.all([
    supabase.from('projects').select('id, name, stage, status').order('created_at'),
    supabase.rpc('remaining_gates'),
  ]);
  if (projects.error) throw new Error(projects.error.message);
  if (gates.error) throw new Error(gates.error.message);
  return {
    now: new Date(),
    projects: projects.data ?? [],
    // The generated type cannot say which columns may be null; GateRow does.
    gates: (gates.data ?? []) as unknown as GateRow[],
  };
}
