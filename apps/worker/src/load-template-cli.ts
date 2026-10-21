// Run with: pnpm --filter @wpe/worker load-template [path]   (reads apps/worker/.env)
// Default path: templates/intake/generic.v1.json. Running it is the owner's approval of that
// template version: it is stored with status "approved".
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@wpe/shared';
import { loadTemplate, supabaseTemplateDeps } from './load-template';

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set in apps/worker/.env`);
  return v;
}

// pnpm runs this from apps/worker, so the default path is relative to the repository root.
const repoRoot = resolve(import.meta.dirname, '../../..');
const file = resolve(repoRoot, process.argv[2] ?? 'templates/intake/generic.v1.json');
const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));

const admin = createClient<Database>(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const r = await loadTemplate(supabaseTemplateDeps(admin), raw);
switch (r.outcome) {
  case 'loaded':
    console.log(`Loaded ${r.industry} version ${r.version} as approved.`);
    break;
  case 'unchanged':
    console.log(`${r.industry} version ${r.version} is already loaded; nothing to do.`);
    break;
  case 'refused':
    console.error(r.reason);
    process.exit(1);
    break;
  case 'invalid':
    console.error('The template is not valid:');
    for (const e of r.errors) console.error(`  ${e}`);
    process.exit(1);
}
