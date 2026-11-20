import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { artifactSections } from '@/lib/stage-run';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Read-only view of one artifact version. Text is shown as plain text, never as HTML or markdown.
export default async function ArtifactPage({
  params,
}: {
  params: Promise<{ id: string; artifactId: string }>;
}) {
  const { id, artifactId } = await params;
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
  // P3-T12: the reference-site screenshots the Planner run took, shown with the plan (private, short-lived links).
  let shots: { path: string; url: string }[] = [];
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
