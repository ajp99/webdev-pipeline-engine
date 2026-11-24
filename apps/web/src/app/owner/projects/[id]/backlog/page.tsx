import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { actOnBacklog } from './actions';

const KIND: Record<string, string> = {
  question: 'Question',
  assumption: 'Assumption',
  blocker: 'Blocker',
  refused_command: 'Refused command',
};

/** The owner's backlog for a project (P4-T07, P4-T08): what the Builder asked, assumed, was blocked on or was refused. */
export default async function BacklogPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { id } = await params;
  const { notice, error } = await searchParams;
  await requireRole('owner', `/owner/projects/${id}/backlog`);
  const supabase = await createClient();
  const items = await supabase
    .from('backlog_items')
    .select(
      'id, round, kind, question, context, options, assumption, owner_answer, ask_client, client_answer, answer_action, status',
    )
    .eq('project_id', id)
    .order('created_at', { ascending: false })
    .limit(300);
  if (items.error) throw new Error(items.error.message);
  const rows = items.data ?? [];
  const open = rows.filter(
    (r) => r.status === 'open' && !r.ask_client && r.kind !== 'refused_command',
  );
  return (
    <main className="mx-auto max-w-4xl p-6">
      <Link href={`/owner/projects/${id}/stage`} className="text-sm underline">
        Back to the project
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Backlog</h1>
      <p className="mt-1 text-sm text-neutral-600">
        {open.length
          ? `${open.length} open question${open.length === 1 ? '' : 's'} or blocker${open.length === 1 ? '' : 's'}: the next round waits until they are answered, accepted or sent to the client.`
          : 'Nothing is waiting for you.'}
      </p>
      {notice ? <p className="mt-3 rounded bg-green-50 p-2 text-sm">{notice}</p> : null}
      {error ? <p className="mt-3 rounded bg-red-50 p-2 text-sm">{error}</p> : null}
      <ul className="mt-4 flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded border p-3 text-sm">
            <div className="flex flex-wrap gap-2 text-xs text-neutral-600">
              <span className="font-medium">{KIND[r.kind] ?? r.kind}</span>
              {r.round !== null ? <span>round {r.round}</span> : null}
              <span>
                {r.ask_client && r.status === 'open'
                  ? 'waiting for the client'
                  : r.status.replace('_', ' ')}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap">{r.question}</p>
            {r.context ? <p className="mt-1 text-neutral-600">{r.context}</p> : null}
            {r.options ? <p className="mt-1 text-neutral-600">Considered: {r.options}</p> : null}
            {r.assumption ? (
              <p className="mt-1 text-neutral-600">Assumed meanwhile: {r.assumption}</p>
            ) : null}
            {r.owner_answer ? <p className="mt-1">Your answer: {r.owner_answer}</p> : null}
            {r.client_answer ? (
              <p className="mt-1">
                Client's answer (
                {r.answer_action === 'immediate_fix' ? 'immediate fix' : 'next round'}):{' '}
                {r.client_answer}
              </p>
            ) : null}
            {r.kind !== 'refused_command' && r.status === 'open' ? (
              <form action={actOnBacklog} className="mt-2 flex flex-col gap-2">
                <input type="hidden" name="projectId" value={id} />
                <input type="hidden" name="itemId" value={r.id} />
                <textarea
                  name="text"
                  rows={2}
                  maxLength={4000}
                  placeholder={
                    r.ask_client ? "The client's answer, as they gave it" : 'Your answer'
                  }
                  className="rounded border p-2"
                />
                <div className="flex flex-wrap gap-2">
                  {r.ask_client ? (
                    <>
                      <button name="action" value="next_round" className="rounded border px-3 py-1">
                        Client answered: use in the next round
                      </button>
                      <button
                        name="action"
                        value="immediate_fix"
                        className="rounded border px-3 py-1"
                      >
                        Client answered: fix the round in review now
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        name="action"
                        value="answer"
                        className="rounded bg-neutral-900 px-3 py-1 text-white"
                      >
                        Answer
                      </button>
                      {r.assumption ? (
                        <button
                          name="action"
                          value="accept_assumption"
                          className="rounded border px-3 py-1"
                        >
                          Accept the assumption
                        </button>
                      ) : null}
                      <button name="action" value="ask_client" className="rounded border px-3 py-1">
                        Ask the client
                      </button>
                    </>
                  )}
                </div>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">The backlog is empty.</p>
      ) : null}
    </main>
  );
}
