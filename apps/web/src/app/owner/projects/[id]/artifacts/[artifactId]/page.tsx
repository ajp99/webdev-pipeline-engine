import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { skillsUsed } from '@/lib/plan-edit';
import { artifactSections, prototypeView } from '@/lib/stage-run';
import { actOnNote, recordPrototypeNote, saveSkillMarks } from './actions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Read-only view of one artifact version. Text is shown as plain text, never as HTML or markdown.
export default async function ArtifactPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; artifactId: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { id, artifactId } = await params;
  const { notice, error } = await searchParams;
  await requireRole('owner', `/owner/projects/${id}/artifacts/${artifactId}`);
  const supabase = await createClient();
  const art = await supabase
    .from('artifacts')
    .select('id, type, version, status, content, created_at, projects(name)')
    .eq('id', artifactId)
    .eq('project_id', id)
    .maybeSingle();
  if (art.error) throw new Error(art.error.message);
  if (!art.data) notFound();
  const a = art.data;
  const sections = artifactSections(a.content);
  const skills = skillsUsed(a.type, a.content);
  const stage = a.type === 'plan' || a.type === 'prototype' ? a.type : null;
  const [notes, marks] = await Promise.all([
    a.type === 'prototype'
      ? supabase
          .from('comments')
          .select('id, body, owner_disposition, created_at')
          .eq('artifact_id', a.id)
          .eq('kind', 'prototype')
      : Promise.resolve({ data: [], error: null }),
    stage && skills.length
      ? supabase.from('skill_uses').select('skill, mark').eq('project_id', id).eq('stage', stage)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (notes.error) throw new Error(notes.error.message);
  if (marks.error) throw new Error(marks.error.message);
  const markOf = new Map((marks.data ?? []).map((m) => [m.skill, m.mark]));
  const note = (notes.data ?? [])[0];
  // P3-T12: the reference-site screenshots the Planner run took, shown with the plan (private, short-lived links).
  let shots: { path: string; url: string }[] = [];
  // P3-T04: the prototype's desktop and mobile screenshots (private, short-lived links).
  let screens: { label: string; url: string }[] = [];
  const proto = a.type === 'prototype' ? prototypeView(a.content) : null;
  if (proto) {
    const signed = await supabase.storage
      .from('intake-uploads')
      .createSignedUrls([proto.screenshots.desktop, proto.screenshots.mobile], 600);
    if (signed.error) throw new Error(signed.error.message);
    screens = (signed.data ?? []).flatMap((x, i) =>
      x.signedUrl ? [{ label: i === 0 ? 'Desktop' : 'Mobile', url: x.signedUrl }] : [],
    );
  }
  if (a.type === 'plan') {
    const rows = await supabase
      .from('uploads')
      .select('storage_path')
      .eq('project_id', id)
      .eq('kind', 'reference_screenshot')
      .order('storage_path');
    if (rows.error) throw new Error(rows.error.message);
    const paths = (rows.data ?? []).map((r) => r.storage_path);
    if (paths.length) {
      const signed = await supabase.storage.from('intake-uploads').createSignedUrls(paths, 600);
      if (signed.error) throw new Error(signed.error.message);
      shots = (signed.data ?? []).flatMap((s) =>
        s.signedUrl && s.path ? [{ path: s.path, url: s.signedUrl }] : [],
      );
    }
  }
  const model = (a.content as { model?: unknown } | null)?.model;
  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">
          {a.projects?.name}: {a.type.replace('_', ' ')} v{a.version}
        </h1>
        <span className="text-sm text-neutral-600">{a.status}</span>
        <Link href={`/owner/projects/${id}/stage`} className="text-sm underline">
          Stage
        </Link>
        <Link href="/owner/queue" className="text-sm underline">
          Approval queue
        </Link>
      </div>
      {notice ? <p className="mt-3 rounded bg-emerald-50 p-3 text-sm">{notice}</p> : null}
      {error ? <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {a.type === 'plan' ? (
        <p className="mt-2 text-sm">
          <Link href={`/owner/projects/${id}/plan/edit`} className="underline">
            Edit the plan
          </Link>{' '}
          <span className="text-neutral-500">
            (round count, hard rounds and budget are yours to confirm when you accept)
          </span>
        </p>
      ) : null}
      <p className="mt-1 text-sm text-neutral-500">
        Written {new Date(a.created_at).toLocaleString()}
        {typeof model === 'string' ? ` by ${model}` : ''}
      </p>
      {sections ? (
        sections.map((s, i) => (
          <section key={i} className="mt-5">
            <h2 className="font-medium">{s.title}</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm">{s.markdown}</p>
          </section>
        ))
      ) : (
        <pre className="mt-5 overflow-x-auto rounded bg-neutral-50 p-3 text-xs">
          {JSON.stringify(a.content, null, 2)}
        </pre>
      )}
      {screens.length ? (
        <section className="mt-8">
          <h2 className="font-medium">Screenshots for the client</h2>
          <p className="text-sm text-neutral-600">
            Send these to the client outside the pipeline; the local preview is for you only.
          </p>
          <div className="mt-2 flex flex-wrap items-start gap-4">
            {screens.map((x) => (
              <figure key={x.label} className={x.label === 'Mobile' ? 'w-48' : 'max-w-2xl flex-1'}>
                <a href={x.url} target="_blank" rel="noreferrer">
                  <img
                    src={x.url}
                    alt={`${x.label} screenshot of the prototype's main page`}
                    className="w-full rounded border"
                  />
                </a>
                <figcaption className="mt-1 text-xs text-neutral-500">
                  {x.label} (opens full size)
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}
      {a.type === 'prototype' ? (
        <section className="mt-8 rounded border p-4">
          <h2 className="font-medium">The client&apos;s reply on this version</h2>
          {note ? (
            <>
              <p className="mt-2 whitespace-pre-wrap rounded bg-amber-50 p-2 text-sm">
                {note.body}
              </p>
              {note.owner_disposition ? (
                <p className="mt-2 text-sm text-neutral-600">
                  Handled: {note.owner_disposition.replace('_', ' ')}.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    [
                      ['forward', 'Forward to the agent (uses a revision)'],
                      ['change_request', 'Make it a change request'],
                      ['dismiss', 'Dismiss'],
                    ] as const
                  ).map(([action, label]) => (
                    <form key={action} action={actOnNote}>
                      <input type="hidden" name="projectId" value={id} />
                      <input type="hidden" name="artifactId" value={a.id} />
                      <input type="hidden" name="commentId" value={note.id} />
                      <input type="hidden" name="action" value={action} />
                      <button type="submit" className="rounded border px-3 py-1 text-sm">
                        {label}
                      </button>
                    </form>
                  ))}
                </div>
              )}
            </>
          ) : (
            <form action={recordPrototypeNote} className="mt-2">
              <input type="hidden" name="projectId" value={id} />
              <input type="hidden" name="artifactId" value={a.id} />
              <label className="text-sm">
                What the client asked for (one note per version; agents see it only if you forward
                it):
                <textarea
                  name="body"
                  required
                  maxLength={5000}
                  rows={3}
                  className="mt-1 w-full rounded border p-1.5"
                />
              </label>
              <button type="submit" className="mt-1 rounded border px-3 py-1.5 text-sm">
                Record the note
              </button>
            </form>
          )}
          <p className="mt-3 text-xs text-neutral-500">
            The client&apos;s approval is recorded in the approval queue, after yours, with a note
            naming the channel. At most 2 revisions; after that, accept or reject.
          </p>
        </section>
      ) : null}
      {stage && skills.length ? (
        <section className="mt-8">
          <h2 className="font-medium">Skills used (optional marks)</h2>
          <form action={saveSkillMarks} className="mt-2 space-y-1 text-sm">
            <input type="hidden" name="projectId" value={id} />
            <input type="hidden" name="artifactId" value={a.id} />
            {skills.map((sk) => (
              <label key={sk} className="flex items-center gap-2">
                <span className="w-72 font-mono text-xs">{sk}</span>
                <select
                  name={`mark_${sk}`}
                  defaultValue={markOf.get(sk) ?? ''}
                  className="rounded border p-1"
                >
                  <option value="">not marked</option>
                  <option value="good">good</option>
                  <option value="bad">bad</option>
                </select>
              </label>
            ))}
            <button type="submit" className="mt-2 rounded border px-3 py-1 text-sm">
              Save marks
            </button>
          </form>
        </section>
      ) : null}
      {shots.length ? (
        <section className="mt-8">
          <h2 className="font-medium">Reference sites the client listed</h2>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            {shots.map((s) => (
              <figure key={s.path}>
                {/* Signed URL to a private object: next/image would need the storage host configured. */}
                <img
                  src={s.url}
                  alt={`Screenshot of ${s.path
                    .split('-')
                    .slice(1)
                    .join('-')
                    .replace(/\.jpg$/, '')}`}
                  className="w-full rounded border"
                />
                <figcaption className="mt-1 text-xs text-neutral-500">
                  {s.path.split('/').pop()}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
