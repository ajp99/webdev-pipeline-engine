import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutoRefresh } from '@/components/AutoRefresh';
import { requireRole } from '@/lib/auth';
import { isActive, statusLabel } from '@/lib/runs';
import { previewUrl, runBlocked, STAGE_ARTIFACT } from '@/lib/stage-run';
import { createClient } from '@/lib/supabase/server';
import { runStage } from './actions';

export const dynamic = 'force-dynamic';

export default async function StagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { id } = await params;
  await requireRole('owner', `/owner/projects/${id}/stage`);
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
  const [runs, artifacts] = await Promise.all([
    supabase
      .from('stage_runs')
      .select('id, stage, status, attempts, queued_at, ended_at')
      .eq('project_id', id)
      .order('queued_at', { ascending: false })
      .limit(10),
    supabase
      .from('artifacts')
      .select('id, type, version, status, created_at')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  if (runs.error) throw new Error(runs.error.message);
  if (artifacts.error) throw new Error(artifacts.error.message);
  const runList = runs.data ?? [];
  const hasOpenRun = runList.some((r) => isActive(r.status));
  const stageType = STAGE_ARTIFACT[p.stage];
  const newest = (artifacts.data ?? []).find((a) => a.type === stageType);
  const blocked = runBlocked({
    stage: p.stage,
    status: p.status,
    hasOpenRun,
    newestApproved: newest?.status === 'approved',
  });

  // The preview the Builder logged on its newest build run that has one.
  let preview: string | null = null;
  const lastBuild = runList.find((r) => r.stage === 'build_rounds');
  if (lastBuild) {
    const logs = await supabase
      .from('run_logs')
      .select('message')
      .eq('run_id', lastBuild.id)
      .like('message', 'Preview: %')
      .order('id', { ascending: false })
      .limit(5);
    if (logs.error) throw new Error(logs.error.message);
    preview = previewUrl((logs.data ?? []).map((l) => l.message));
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      {hasOpenRun ? <AutoRefresh /> : null}
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">{p.name}</h1>
        <span className="text-sm text-neutral-600">
          {p.stage.replace('_', ' ')} stage, {p.status}
        </span>
        <Link href="/owner" className="text-sm underline">
          Projects
        </Link>
        <Link href="/owner/queue" className="text-sm underline">
          Approval queue
        </Link>
      </div>
      {notice ? <p className="mt-3 rounded bg-emerald-50 p-3 text-sm">{notice}</p> : null}
      {error ? <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      <section className="mt-6">
        <h2 className="font-medium">Run this stage</h2>
        <form action={runStage} className="mt-2 flex items-center gap-3">
          <input type="hidden" name="projectId" value={id} />
          <button
            type="submit"
            disabled={blocked !== null}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            Run {p.stage.replace('_', ' ')}
          </button>
          {blocked ? <span className="text-sm text-neutral-500">{blocked}</span> : null}
        </form>
        {preview ? (
          <p className="mt-3 text-sm">
            Preview:{' '}
            <a href={preview} target="_blank" rel="noreferrer" className="underline">
              {preview}
            </a>{' '}
            <span className="text-neutral-500">(runs on this computer only)</span>
          </p>
        ) : null}
      </section>

      <section className="mt-6">
        <h2 className="font-medium">Artifacts</h2>
        {(artifacts.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">None yet.</p>
        ) : (
          <ul className="mt-2 text-sm">
            {(artifacts.data ?? []).map((a) => (
              <li key={a.id} className="py-0.5">
                <Link href={`/owner/projects/${id}/artifacts/${a.id}`} className="underline">
                  {a.type.replace('_', ' ')} v{a.version}
                </Link>{' '}
                <span className="text-neutral-500">{a.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="font-medium">Recent runs</h2>
        {runList.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">No runs yet.</p>
        ) : (
          <ul className="mt-2 text-sm">
            {runList.map((r) => (
              <li key={r.id} className="py-0.5">
                <Link href={`/owner/runs/${r.id}`} className="underline">
                  {r.stage.replace('_', ' ')}
                </Link>{' '}
                <span className="text-neutral-500">
                  {statusLabel(r.status, r.ended_at)}, attempt {r.attempts}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
