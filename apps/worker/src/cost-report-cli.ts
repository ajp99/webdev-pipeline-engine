// Run with: pnpm --filter @wpe/worker cost-report [project-id]   (reads apps/worker/.env)
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@wpe/shared';
import { buildCostReport, formatCostReport, type CostRow } from './cost-report';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/worker/.env');
const admin = createClient<Database>(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const rows: CostRow[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await admin
    .from('stage_runs')
    .select('project_id, stage, status, attempts, tokens_used, model, started_at, finished_at')
    .order('queued_at')
    .range(from, from + 999);
  if (error) throw new Error(error.message);
  rows.push(...(data as CostRow[]));
  if (data.length < 1000) break;
}
console.log(formatCostReport(buildCostReport(rows, process.argv[2])));
