import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@wpe/shared';
import type { Role } from '../routing';

/**
 * Looks up the signed-in user's role. Row-level security lets an owner read the owners table and a
 * client read only their own clients row, so a missing row means "no role", never "not allowed to ask".
 */
export async function lookupRole(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Role> {
  const owner = await supabase.from('owners').select('id').eq('id', userId).maybeSingle();
  if (owner.data) return 'owner';
  const client = await supabase.from('clients').select('id').eq('id', userId).maybeSingle();
  if (client.data) return 'client';
  return null;
}
