import { redirect } from 'next/navigation';
import { decideAccess, type Role } from './routing';
import { createClient } from './supabase/server';
import { lookupRole } from './supabase/roles';

export type Session = { userId: string; email: string | null; role: Role };

/** The validated session, or null when signed out. Checks with the Auth server, not just the cookie. */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    role: await lookupRole(supabase, data.user.id),
  };
}

/** Layout guard: the proxy already redirects, this is the second check inside the page itself. */
export async function requireRole(role: 'owner' | 'client', pathname: string): Promise<Session> {
  const session = await getSession();
  const access = decideAccess(session !== null, session?.role ?? null, pathname);
  if (access.kind === 'redirect') redirect(access.to);
  if (!session || session.role !== role) redirect('/login');
  return session;
}
