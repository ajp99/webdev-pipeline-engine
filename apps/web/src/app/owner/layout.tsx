import Link from 'next/link';
import type { ReactNode } from 'react';
import { buildQueue } from '@wpe/shared';
import { requireRole } from '@/lib/auth';
import { loadQueueInput } from '@/lib/queue-data';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '../login/actions';

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const session = await requireRole('owner', '/owner');
  const supabase = await createClient();
  const queue = buildQueue(await loadQueueInput(supabase));
  const waiting = queue.items.filter((i) => i.actionable).length + queue.ready.length;
  const overdue = queue.items.filter((i) => i.overdue).length;
  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-6 border-b border-neutral-200 px-6 py-3">
        <span className="font-semibold">CreatePipeline Engine</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/owner">Projects</Link>
          <Link href="/owner/queue" className="flex items-center gap-1">
            Approval queue
            {waiting > 0 ? (
              <span className="rounded-full bg-neutral-900 px-2 text-xs text-white">{waiting}</span>
            ) : null}
            {overdue > 0 ? (
              <span className="rounded-full bg-red-600 px-2 text-xs text-white">
                {overdue} overdue
              </span>
            ) : null}
          </Link>
        </nav>
        <form action={signOut} className="ml-auto flex items-center gap-3 text-sm">
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
