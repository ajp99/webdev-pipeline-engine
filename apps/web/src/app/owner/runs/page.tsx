import { AutoRefresh } from '@/components/AutoRefresh';
import { RunRow } from '@/components/RunRow';
import { isActive, type RunRowData } from '@/lib/runs';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function RunsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stage_runs')
    .select(
      'id, stage, status, attempts, queued_at, started_at, finished_at, tokens_used, model, projects(name)',
    )
    .order('queued_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  const runs: RunRowData[] = data.map((r) => ({
    id: r.id,
    projectName: r.projects?.name ?? '(unknown project)',
    stage: r.stage,
    status: r.status,
    attempts: r.attempts,
    queuedAt: r.queued_at,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    tokensUsed: r.tokens_used,
    model: r.model,
  }));
  const now = new Date();
  return (
    <main className="mx-auto max-w-4xl p-6">
      {runs.some((r) => isActive(r.status)) ? <AutoRefresh /> : null}
      <h1 className="text-xl font-semibold">Runs</h1>
      <p className="mt-1 text-sm text-neutral-600">
        The last 30 runs of the stage runner. Cancel stops a queued run at once and asks a running
        one to stop at its next check.
      </p>
      {runs.length === 0 ? (
        <p className="mt-4 text-neutral-600">No runs yet.</p>
      ) : (
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-neutral-500">
            <tr>
              <th className="py-2">Project</th>
              <th>Stage</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Time</th>
              <th>Tokens</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <RunRow key={r.id} run={r} now={now} />
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
