import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutoRefresh } from '@/components/AutoRefresh';
import { requireRole } from '@/lib/auth';
import {
  canCancel,
  canRetry,
  durationLabel,
  isActive,
  logWindow,
  statusLabel,
  timeline,
} from '@/lib/runs';
import { createClient } from '@/lib/supabase/server';
import { cancelRun, retryRun } from '../actions';

export const dynamic = 'force-dynamic';

const LEVEL_STYLE: Record<string, string> = {
  error: 'text-red-700',
  warn: 'text-amber-800',
  info: 'text-neutral-700',
  debug: 'text-neutral-500',
};

export default async function RunDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; notice?: string; error?: string }>;
}) {
  const { id } = await params;
  await requireRole('owner', `/owner/runs/${id}`);
  const { page, notice, error } = await searchParams;
  const supabase = await createClient();
  const run = await supabase
    .from('stage_runs')
    .select(
      'id, stage, status, attempts, queued_at, started_at, finished_at, tokens_used, model, trace_id, project_id, projects(name, stage, status)',
    )
    .eq('id', id)
    .maybeSingle();
  if (run.error) throw new Error(run.error.message);
  if (!run.data) notFound();
  const r = run.data;

  const count = await supabase
    .from('run_logs')
    .select('id', { count: 'exact', head: true })
    .eq('run_id', id);
  if (count.error) throw new Error(count.error.message);
  const total = count.count ?? 0;
  const w = logWindow(total, page === undefined ? null : Number(page));
  const [lines, reason] = await Promise.all([
    supabase
      .from('run_logs')
      .select('id, level, message, created_at')
      .eq('run_id', id)
      .order('id')
      .range(w.from, w.to),
    // Why it failed: the newest error line of the whole log, not only of this page.
    supabase
      .from('run_logs')
      .select('message')
      .eq('run_id', id)
      .eq('level', 'error')
      .order('id', { ascending: false })
      .limit(1),
  ]);
  if (lines.error) throw new Error(lines.error.message);
  if (reason.error) throw new Error(reason.error.message);

  const now = new Date();
  const steps = timeline({
    queuedAt: r.queued_at,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    status: r.status,
  });
  const project = r.projects;
  const later = project && project.stage !== r.stage;
  const href = (p: number) => `/owner/runs/${id}?page=${p}`;

  return (
    <main className="mx-auto max-w-4xl p-6">
      {isActive(r.status) ? <AutoRefresh /> : null}
      <p className="text-sm">
        <Link href="/owner/runs" className="underline">
          All runs
        </Link>
      </p>
      <h1 className="mt-2 text-xl font-semibold">
        {project?.name ?? '(unknown project)'}: {r.stage.replace('_', ' ')}{' '}
        <span className="text-base font-normal text-neutral-600">{statusLabel(r.status)}</span>
        {r.model === 'stub' ? <span className="ml-2 text-xs text-neutral-500">(stub)</span> : null}
      </h1>
      {notice ? (
        <p role="status" className="mt-3 rounded bg-green-50 p-3 text-sm text-green-900">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {r.status === 'failed' || r.status === 'stopped' ? (
        <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">
          {r.status === 'stopped'
            ? 'The run stopped: no activity for too long.'
            : 'The run failed.'}{' '}
          {reason.data[0]?.message
            ? `Last error: ${reason.data[0].message.slice(0, 500)}`
            : 'No error line was logged.'}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {canRetry(r.status) ? (
          <form action={retryRun}>
            <input type="hidden" name="runId" value={r.id} />
            <button type="submit" className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">
              Retry
            </button>
          </form>
        ) : null}
        {canCancel(r.status) ? (
          <form action={cancelRun}>
            <input type="hidden" name="runId" value={r.id} />
            <button type="submit" className="rounded border border-neutral-400 px-4 py-2 text-sm">
              Cancel
            </button>
          </form>
        ) : null}
        {canRetry(r.status) ? (
          <span className="text-sm text-neutral-600">
            {later
              ? `The project is now in ${project.stage.replace('_', ' ')}, so this stage cannot be run again.`
              : 'Retry queues a new run for this stage with fresh attempts; this run stays as history.'}
          </span>
        ) : null}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-neutral-500">Attempts</dt>
          <dd>{r.attempts}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Time</dt>
          <dd>{durationLabel(r.started_at, r.finished_at, now) || 'not started'}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Tokens</dt>
          <dd>{r.tokens_used}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Model</dt>
          <dd>{r.model ?? 'none'}</dd>
        </div>
      </dl>

      <h2 className="mt-6 font-medium">Timeline</h2>
      <ol className="mt-1 text-sm">
        {steps.map((s) => (
          <li key={s.label}>
            {s.label}: {new Date(s.at).toLocaleString('en-GB')}
          </li>
        ))}
      </ol>

      <h2 className="mt-6 font-medium">
        Log <span className="text-sm font-normal text-neutral-500">({total} lines)</span>
      </h2>
      {total === 0 ? (
        <p className="mt-1 text-sm text-neutral-600">No log lines.</p>
      ) : (
        <>
          <ol className="mt-2 overflow-x-auto rounded bg-neutral-50 p-3 font-mono text-xs">
            {lines.data.map((l) => (
              <li key={l.id} className={`whitespace-pre-wrap ${LEVEL_STYLE[l.level] ?? ''}`}>
                <span className="text-neutral-400">
                  {new Date(l.created_at).toLocaleTimeString('en-GB')}
                </span>{' '}
                {l.level} {l.message}
              </li>
            ))}
          </ol>
          <nav aria-label="Log pages" className="mt-2 flex items-center gap-3 text-sm">
            {w.page > 1 ? (
              <Link href={href(w.page - 1)} className="underline">
                Older
              </Link>
            ) : null}
            <span className="text-neutral-600">
              Page {w.page} of {w.pages}
            </span>
            {w.page < w.pages ? (
              <Link href={href(w.page + 1)} className="underline">
                Newer
              </Link>
            ) : null}
          </nav>
        </>
      )}
    </main>
  );
}
