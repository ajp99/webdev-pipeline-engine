import Link from 'next/link';
import { notFound } from 'next/navigation';
import Markdown from 'react-markdown';
import { asPrd, PRD_SECTIONS, prdMarkdown, prdNotesProblem, type PrdNotes } from '@wpe/shared';
import { requireRole } from '@/lib/auth';
import { signedVersion, versionList } from '@/lib/prd-view';
import { createClient } from '@/lib/supabase/server';
import { recordFeedback, recordSignOff } from './actions';

export const dynamic = 'force-dynamic';

// The PRD page (P2-T08, P2-T09): the newest version, the text to send to the client, the client's reply
// recorded by the owner, the version history and the owner-only notes.
export default async function PrdPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { id } = await params;
  await requireRole('owner', `/owner/projects/${id}/prd`);
  const { notice, error } = await searchParams;
  const supabase = await createClient();
  const project = await supabase
    .from('projects')
    .select('name, stage, status')
    .eq('id', id)
    .maybeSingle();
  if (project.error) throw new Error(project.error.message);
  if (!project.data) notFound();
  const p = project.data;

  const [versions, notesRows, feedback] = await Promise.all([
    supabase
      .from('artifacts')
      .select('id, version, status, created_at, created_by, change_request_id, content')
      .eq('project_id', id)
      .eq('type', 'prd')
      .order('version', { ascending: false }),
    supabase
      .from('artifacts')
      .select('content')
      .eq('project_id', id)
      .eq('type', 'prd_notes')
      .order('version', { ascending: false })
      .limit(1),
    supabase
      .from('prd_feedback')
      .select('id, artifact_id, body, created_at')
      .eq('project_id', id)
      .order('created_at', { ascending: false }),
  ]);
  for (const r of [versions, notesRows, feedback]) if (r.error) throw new Error(r.error.message);
  const rows = versions.data ?? [];
  const approvals = rows.length
    ? await supabase
        .from('approvals')
        .select('artifact_id, role')
        .in(
          'artifact_id',
          rows.map((r) => r.id),
        )
        .eq('role', 'client')
    : { data: [], error: null };
  if (approvals.error) throw new Error(approvals.error.message);
  const signed = signedVersion(
    rows,
    (approvals.data ?? []).map((a) => a.artifact_id),
  );
  const list = versionList(rows, signed);
  const newest = list[0];
  const prd = newest ? asPrd(newest.content) : null;
  const notes = notesRows.data?.[0]?.content;
  const ownerNotes = prdNotesProblem(notes) === null ? (notes as PrdNotes) : null;
  const atRequirements = p.stage === 'requirements' && p.status === 'active';
  const awaitingClient =
    atRequirements && newest && newest.status !== 'approved' && signed === null;
  const label = (v: number) => list.find((r) => r.version === v)?.label ?? `v${v}`;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">{p.name}: PRD</h1>
        <span className="text-sm text-neutral-600">
          {p.stage.replace('_', ' ')} stage, {p.status}
        </span>
        <Link href={`/owner/projects/${id}/stage`} className="text-sm underline">
          Stage
        </Link>
        <Link href={`/owner/projects/${id}/changes`} className="text-sm underline">
          Change requests
        </Link>
        <Link href="/owner/queue" className="text-sm underline">
          Approval queue
        </Link>
      </div>
      {notice ? <p className="mt-3 rounded bg-emerald-50 p-3 text-sm">{notice}</p> : null}
      {error ? <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      {!newest || !prd ? (
        <p className="mt-6 text-sm text-neutral-600">
          No PRD yet. Run the requirements stage from the stage page, or{' '}
          {atRequirements ? (
            <Link href={`/owner/projects/${id}/prd/edit`} className="underline">
              write one by hand
            </Link>
          ) : (
            'wait for the requirements stage'
          )}
          .
        </p>
      ) : (
        <>
          <section className="mt-6">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="font-medium">
                {newest.label}{' '}
                <span className="text-sm text-neutral-500">
                  ({newest.status}, by {newest.author})
                </span>
              </h2>
              {atRequirements && newest.status !== 'approved' ? (
                <Link href={`/owner/projects/${id}/prd/edit`} className="text-sm underline">
                  Edit
                </Link>
              ) : null}
              {list.length > 1 ? (
                <Link
                  href={`/owner/projects/${id}/prd/compare?a=${list[1]!.version}&b=${newest.version}`}
                  className="text-sm underline"
                >
                  Compare with {list[1]!.label}
                </Link>
              ) : null}
            </div>
            {prd.change_summary ? (
              <p className="mt-2 rounded bg-neutral-50 p-3 text-sm">
                <span className="font-medium">What changed:</span> {prd.change_summary}
              </p>
            ) : null}
            {PRD_SECTIONS.map((s) => (
              <div key={s.key} className="mt-4">
                <h3 className="text-sm font-semibold">{s.title}</h3>
                <div className="md mt-1 text-sm">
                  <Markdown>{prd.sections[s.key]}</Markdown>
                </div>
              </div>
            ))}
            <p className="mt-4 text-sm">
              <span className="font-semibold">Contact form spam protection:</span>{' '}
              {prd.spam_protection.replace(/_/g, ' ')}
            </p>
          </section>

          {awaitingClient ? (
            <section className="mt-8 rounded border p-4">
              <h2 className="font-medium">Send to the client and record the reply</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Copy this text into your email or message. There is no client login or email until
                go-live.
              </p>
              <textarea
                readOnly
                rows={8}
                className="mt-2 w-full rounded border p-2 font-mono text-xs"
                defaultValue={`${prd.change_summary ? `What changed: ${prd.change_summary}\n\n` : ''}${prdMarkdown(prd)}`}
              />
              <form action={recordSignOff} className="mt-4 flex flex-wrap items-end gap-2">
                <input type="hidden" name="projectId" value={id} />
                <input type="hidden" name="artifactId" value={newest.id} />
                <label className="flex-1 text-sm">
                  The client signed off. How? (required)
                  <input
                    name="note"
                    required
                    maxLength={2000}
                    placeholder="Email of 3 March"
                    className="mt-1 w-full rounded border p-1.5"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white"
                >
                  Record sign-off
                </button>
              </form>
              <form action={recordFeedback} className="mt-4">
                <input type="hidden" name="projectId" value={id} />
                <input type="hidden" name="artifactId" value={newest.id} />
                <label className="text-sm">
                  The client asked for changes (for you only; agents never see it):
                  <textarea
                    name="body"
                    required
                    maxLength={4000}
                    rows={3}
                    className="mt-1 w-full rounded border p-1.5"
                  />
                </label>
                <button type="submit" className="mt-1 rounded border px-3 py-1.5 text-sm">
                  Record request for changes
                </button>
              </form>
            </section>
          ) : null}

          {!awaitingClient && newest.change_request_id ? (
            <section className="mt-8 rounded border p-4">
              <h2 className="font-medium">Send {newest.label} to the client</h2>
              <p className="mt-1 text-sm text-neutral-600">
                This version comes from an accepted change request and needs no new sign-off. Copy
                it with its summary into your email or message.
              </p>
              <textarea
                readOnly
                rows={8}
                className="mt-2 w-full rounded border p-2 font-mono text-xs"
                defaultValue={`${prd.change_summary ? `What changed: ${prd.change_summary}\n\n` : ''}${prdMarkdown(prd)}`}
              />
            </section>
          ) : null}
        </>
      )}

      {(feedback.data ?? []).length > 0 ? (
        <section className="mt-8">
          <h2 className="font-medium">Client requests for changes</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {(feedback.data ?? []).map((f) => (
              <li key={f.id} className="rounded bg-amber-50 p-2">
                <span className="text-neutral-500">
                  On {label(rows.find((r) => r.id === f.artifact_id)?.version ?? 0)},{' '}
                  {new Date(f.created_at).toLocaleString('en-GB')}:
                </span>{' '}
                {f.body}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {ownerNotes ? (
        <section className="mt-8">
          <h2 className="font-medium">Gaps and conflicts (owner only)</h2>
          {(['gaps', 'conflicts'] as const).map((k) => (
            <div key={k} className="mt-2 text-sm">
              <h3 className="font-semibold capitalize">{k}</h3>
              {ownerNotes[k].length === 0 ? (
                <p className="text-neutral-500">None.</p>
              ) : (
                <ul className="list-disc pl-5">
                  {ownerNotes[k].map((n, i) => (
                    <li key={i}>
                      {n.issue}
                      {n.resolution ? (
                        <span className="text-neutral-500"> ({n.resolution})</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      ) : null}

      {list.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-medium">Versions</h2>
          <ul className="mt-2 text-sm">
            {list.map((v, i) => (
              <li key={v.id} className="py-0.5">
                {v.label}{' '}
                <span className="text-neutral-500">
                  {v.status}, by {v.author}, {new Date(v.created_at).toLocaleString('en-GB')}
                </span>
                {v.change_request_id ? (
                  <span className="text-neutral-500"> (change request)</span>
                ) : null}{' '}
                {list[i + 1] ? (
                  <Link
                    href={`/owner/projects/${id}/prd/compare?a=${list[i + 1]!.version}&b=${v.version}`}
                    className="underline"
                  >
                    compare with {list[i + 1]!.label}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
