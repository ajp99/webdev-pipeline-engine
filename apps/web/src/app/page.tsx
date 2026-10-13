import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { homeFor } from '@/lib/routing';

// The proxy normally redirects before this renders; this is the fallback.
export default async function Home() {
  const session = await getSession();
  redirect(session ? homeFor(session.role) : '/login');
}
