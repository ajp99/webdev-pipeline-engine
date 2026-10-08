// Pure routing rules for sign-in and roles (P1-T05). Used by the proxy and the layouts.
export type Role = 'owner' | 'client' | null;

export type Access = { kind: 'allow' } | { kind: 'redirect'; to: string };

const LOGIN = '/login';

export function homeFor(role: Role): string {
  if (role === 'owner') return '/owner';
  if (role === 'client') return '/client';
  return LOGIN;
}

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Decides what a request may see.
 * `signedIn` means a validated Supabase user; `role` comes from the owners and clients tables
 * (owner wins if both exist, which the database should never allow in practice).
 */
export function decideAccess(signedIn: boolean, role: Role, pathname: string): Access {
  const isLogin = under(pathname, LOGIN);

  if (!signedIn) {
    return isLogin ? { kind: 'allow' } : { kind: 'redirect', to: LOGIN };
  }
  // Signed in but with no owner or client row: nothing to show except the login page.
  if (role === null) {
    return isLogin ? { kind: 'allow' } : { kind: 'redirect', to: `${LOGIN}?error=no_role` };
  }
  if (isLogin || pathname === '/') return { kind: 'redirect', to: homeFor(role) };
  if (under(pathname, '/owner') && role !== 'owner') return { kind: 'redirect', to: homeFor(role) };
  if (under(pathname, '/client') && role !== 'client')
    return { kind: 'redirect', to: homeFor(role) };
  return { kind: 'allow' };
}
