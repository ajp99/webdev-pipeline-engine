import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@wpe/shared';
import { supabaseEnv } from './lib/env';
import { decideAccess } from './lib/routing';
import { lookupRole } from './lib/supabase/roles';

// Refreshes the Supabase session cookie and sends visitors to the area their role may see.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = supabaseEnv();
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const role = data.user ? await lookupRole(supabase, data.user.id) : null;
  const access = decideAccess(data.user !== null, role, request.nextUrl.pathname);

  if (access.kind === 'redirect') {
    const target = new URL(access.to, request.url);
    const redirect = NextResponse.redirect(target);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
