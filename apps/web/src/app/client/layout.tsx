import type { ReactNode } from 'react';
import { requireRole } from '@/lib/auth';
import { signOut } from '../login/actions';

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const session = await requireRole('client', '/client');
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <span className="font-semibold">Your project</span>
        <form action={signOut} className="flex items-center gap-3 text-sm">
          <span className="text-neutral-600">{session.email}</span>
          <button type="submit" className="underline">
            Sign out
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
