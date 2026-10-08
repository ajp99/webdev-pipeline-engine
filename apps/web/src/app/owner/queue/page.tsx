import { buildQueue } from '@wpe/shared';
import { loadQueueInput } from '@/lib/queue-data';
import { createClient } from '@/lib/supabase/server';
import { QueueItemCard } from '@/components/QueueItemCard';

export const dynamic = 'force-dynamic';

export default async function QueuePage() {
  const supabase = await createClient();
  const queue = buildQueue(await loadQueueInput(supabase));
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">Approval queue</h1>
      {queue.items.length === 0 ? (
        <p className="mt-4 text-neutral-600">Nothing is waiting for you.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {queue.items.map((item) => (
            <QueueItemCard key={item.key} item={item} />
          ))}
        </ul>
      )}
      {queue.waitingForAgent.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-neutral-600">Waiting for the agent</h2>
          <ul className="mt-2 text-sm text-neutral-700">
            {queue.waitingForAgent.map((p) => (
              <li key={p.id}>
                {p.name} <span className="text-neutral-500">({p.stage.replace('_', ' ')})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
