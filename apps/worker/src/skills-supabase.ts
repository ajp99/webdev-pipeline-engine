// skills_registry through the service key (P3-T01). Only library rows are read and written here.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@wpe/shared';
import type { RegistryDeps } from './skills';

export function supabaseRegistryDeps(admin: SupabaseClient<Database>): RegistryDeps {
  const check = (r: { error: { message: string } | null }) => {
    if (r.error) throw new Error(`skills_registry: ${r.error.message}`);
  };
  return {
    async listLibrary() {
      const r = await admin
        .from('skills_registry')
        .select('id, name, scope, version')
        .eq('scope', 'library');
      check(r);
      return r.data ?? [];
    },
    async insert(row) {
      check(await admin.from('skills_registry').insert({ ...row, scope: 'library' }));
    },
    async setVersion(id, version) {
      check(await admin.from('skills_registry').update({ version }).eq('id', id));
    },
    async deprecate(id) {
      check(await admin.from('skills_registry').update({ scope: 'deprecated' }).eq('id', id));
    },
  };
}
