// Run with: pnpm --filter @wpe/worker seed-demo   (reads apps/worker/.env)
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@wpe/shared';
import { seedDemo, supabaseSeedDeps } from './seed-demo';

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set in apps/worker/.env`);
  return v;
}

const admin = createClient<Database>(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const r = await seedDemo(
  supabaseSeedDeps(admin),
  new Date().toISOString().slice(0, 16).replace('T', ' '),
);
console.log(`Created the demo project ${r.projectId} with intake record ${r.artifactId}.`);
console.log('Open the owner console, go to Approval queue and press Accept.');
