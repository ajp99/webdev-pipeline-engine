import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { changeRequestNext, DECISIONS } from '@/lib/prd-view';
import { createClient } from '@/lib/supabase/server';
import { decideChange, recordChange } from './actions';

export const dynamic = 'force-dynamic';

// Change requests (P2-T10, D-326): the owner records what the client sent outside the pipeline, decides it with
// an impact note, and writes the PRD version for an accepted one.
export default async function ChangesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { id } = await params;
  await requireRole('owner', `/owner/projects/${id}/changes`);
  const { notice, error } = await searchParams;
  const supabase = await createClient();
  const project = await supabase
    .from('projects')
    .select('name, stage, status, changes_frozen_at')
    .eq('id', id)
    .maybeSingle();
  if (project.error) throw new Error(project.error.message);
  if (!project.data) notFound();
  const p = project.data;
  const [requests, prdVersions] = await Promise.all([
    supabase
      .from('change_requests')
      .select(
        'id, description, affected_pages, affected_features, impact_note, decision, status, created_at, decided_at',
      )
      .eq('project_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('artifacts')
      .select('change_request_id')
      .eq('project_id', id)
      .eq('type', 'prd')
      .not('change_request_id', 'is', null),
  ]);
  if (requests.error) throw new Error(requests.error.message);
  if (prdVersions.error) throw new Error(prdVersions.error.message);
  const withPrd = new Set((prdVersions.data ?? []).map((r) => r.change_request_id));
  const open =
    p.status === 'active' &&
    !['intake', 'requirements'].includes(p.stage) &&
    p.changes_frozen_at === null;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">{p.name}: change requests</h1>
        <Link href={`/owner/projects/${id}/prd`} className="text-sm underline">
          PRD
        </Link>
        <Link href={`/owner/projects/${id}/stage`} className="text-sm underline">
          Stage
        </Link>
      </div>
      {notice ? <p className="mt-3 rounded bg-emerald-50 p-3 text-sm">{notice}</p> : null}
      {error ? <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      {open ? (
        <form action={recordChange} className="mt-6 space-y-2 rounded border p-4 text-sm">
          <h2 className="font-medium">Record a request from the client</h2>
          <input type="hidden" name="projectId" value={id} />
          <label className="block">
            What the client asked for
            <textarea
              name="description"
              required
              maxLength={4000}
              rows={3}
              className="mt-1 w-full rounded border p-1.5"
            />
          </label>
          <label className="block">
            Pages it touches (comma or line separated)
            <input name="pages" className="mt-1 w-full rounded border p-1.5" />
          </label>
          <label className="block">
            Features it touches
            <input name="features" className="mt-1 w-full rounded border p-1.5" />
          </label>
          <button type="submit" className="rounded bg-neutral-900 px-3 py-1.5 text-white">
            Record
          </button>
        </form>
      ) : (
        <p className="mt-6 text-sm text-neutral-600">
          {p.stage === 'intake' || p.stage === 'requirements'
            ? 'Change requests start after the PRD sign-off. Until then, edit the PRD.'
            : p.changes_frozen_at
              ? 'Changes are frozen for this project.'
              : 'The project is not active.'}
        </p>
      )}

      <section className="mt-8">
        <h2 className="font-medium">Requests</h2>
        {(requests.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">None.</p>
        ) : (
          <ul className="mt-2 space-y-4 text-sm">
            {(requests.data ?? []).map((cr) => {
              const next = changeRequestNext({ ...cr, hasPrdVersion: withPrd.has(cr.id) });
              return (
                <li key={cr.id} className="rounded border p-3">
                  <p>{cr.description}</p>
                  <p className="mt-1 text-neutral-500">
                    {cr.status}
                    {cr.affected_pages.length ? `; pages: ${cr.affected_pages.join(', ')}` : ''}
                    {cr.affected_features.length
                      ? `; features: ${cr.affected_features.join(', ')}`
                      : ''}
                  </p>
                  {cr.impact_note ? <p className="mt-1">Impact: {cr.impact_note}</p> : null}
                  {next === 'decide' && p.status === 'active' ? (
                    <form action={decideChange} className="mt-2 space-y-2">
                      <input type="hidden" name="projectId" value={id} />
                      <input type="hidden" name="requestId" value={cr.id} />
                      <label className="block">
                        Impact note (time, scope, cost)
                        <textarea
                          name="impactNote"
                          required
                          maxLength={2000}
                          rows={2}
                          className="mt-1 w-full rounded border p-1.5"
                        />
                      </label>
                      <select name="decision" className="rounded border p-1" defaultValue="">
                        <option value="" disabled>
                          Decision…
                        </option>
                        {DECISIONS.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>{' '}
                      <button type="submit" className="rounded bg-neutral-900 px-3 py-1 text-white">
                        Decide
                      </button>
                    </form>
                  ) : null}
                  {next === 'write_prd' ? (
                    <Link
                      href={`/owner/projects/${id}/prd/edit?cr=${cr.id}`}
                      className="mt-2 inline-block underline"
                    >
                      Write the PRD version for this change
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
