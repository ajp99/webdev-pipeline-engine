// Connects the runner to the database functions (claim_run, heartbeat_run, finish_run).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@wpe/shared';
import type { RunnerDeps } from './runner';

export function supabaseRunnerDeps(admin: SupabaseClient<Database>): RunnerDeps {
  return {
    async claim(worker) {
      const { data, error } = await admin.rpc('claim_run', { p_worker: worker });
      if (error) throw new Error(`claim_run: ${error.message}`);
      return data[0] ?? null;
    },
    async heartbeat(runId, worker) {
      const { data, error } = await admin.rpc('heartbeat_run', { p_run: runId, p_worker: worker });
      if (error) throw new Error(`heartbeat_run: ${error.message}`);
      return data;
    },
    async finish(runId, worker, status, tokens) {
      const { data, error } = await admin.rpc('finish_run', {
        p_run: runId,
        p_worker: worker,
        p_status: status,
        p_tokens: tokens,
      });
      if (error) throw new Error(`finish_run: ${error.message}`);
      return data;
    },
  };
}
