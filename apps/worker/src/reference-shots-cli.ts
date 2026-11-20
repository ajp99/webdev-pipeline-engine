// Run with: pnpm --filter @wpe/worker reference-shots <project-id>   (reads apps/worker/.env)
// Takes screenshots of the reference sites the client listed and stores them with the project (P3-T12).
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@wpe/shared';
import { takeShots } from './reference-shots';
import { playwrightBrowser } from './reference-shots-browser';
import { referenceUrls, storeShots } from './reference-shots-supabase';

const need = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set in apps/worker/.env`);
  return v;
};
const projectId = process.argv[2];
if (!projectId)
  throw new Error('Give the project id: pnpm --filter @wpe/worker reference-shots <project-id>');
const admin = createClient<Database>(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const urls = await referenceUrls(admin, projectId);
if (urls.length === 0) console.log('The intake lists no reference sites.');
else {
  const shots = await takeShots(urls, await playwrightBrowser());
  for (const s of shots)
    console.log(`${s.ok ? 'ok     ' : 'refused'} ${s.url}${s.ok ? '' : ` (${s.reason})`}`);
  const stored = await storeShots(admin, projectId, shots);
  console.log(`Stored ${stored.length} screenshot(s) with the project.`);
}
