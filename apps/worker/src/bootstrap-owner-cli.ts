// Run with: pnpm --filter @wpe/worker bootstrap-owner   (reads apps/worker/.env)
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@wpe/shared';
import { bootstrapOwner, supabaseDeps } from './bootstrap-owner';

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set in apps/worker/.env`);
  return v;
}

const admin = createClient<Database>(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const result = await bootstrapOwner(
  supabaseDeps(admin),
  need('OWNER_EMAIL'),
  process.env.OWNER_PASSWORD ?? '',
);
console.log(
  result.createdUser
    ? `Created the owner login and the owners row (${result.userId}). Remove OWNER_PASSWORD from .env now.`
    : `The login already existed; the owners row is in place (${result.userId}).`,
);
