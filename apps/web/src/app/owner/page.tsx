import { buildQueue } from '@wpe/shared';
import { loadQueueInput } from '@/lib/queue-data';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ProjectList() {
  const supabase = await createClient();
  const input = await loadQueueInput(supabase);
  const queue = buildQueue(input);
  const pending = (id: string) => queue.items.filter((i) => i.projectId === id).length;
  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold">Projects</h1>
      {input.projects.length === 0 ? (
        <p className="mt-4 text-neutral-600">No projects yet.</p>
      ) : (
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-neutral-500">
            <tr>
              <th className="py-2">Name</th>
              <th>Stage</th>
              <th>Status</th>
              <th>Waiting on you</th>
            </tr>
          </thead>
          <tbody>
            {input.projects.map((p) => (
              <tr key={p.id} className="border-t border-neutral-200">
                <td className="py-2 font-medium">{p.name}</td>
                <td>{p.stage.replace('_', ' ')}</td>
                <td>{p.status}</td>
                <td>{pending(p.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
