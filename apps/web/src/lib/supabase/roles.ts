import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@wpe/shared';
import type { Role } from '../routing';

/**
 * Looks up the signed-in user's role. Until go-live the owner is the only login (D-298), so a user who
 * is not in the owners table has no role. A client role returns with the client dashboard (go-live G15).
 */
export async function lookupRole(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Role> {
  const owner = await supabase.from('owners').select('id').eq('id', userId).maybeSingle();
  if (owner.data) return 'owner';
  return null;
}
