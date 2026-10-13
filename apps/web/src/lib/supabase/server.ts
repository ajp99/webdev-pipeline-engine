import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@wpe/shared';
import { supabaseEnv } from '../env';

/** Supabase client for server components and server actions, acting as the signed-in user. */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Called from a server component, where cookies are read-only. The proxy refreshes the session.
        }
      },
    },
  });
}
