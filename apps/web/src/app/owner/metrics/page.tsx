import Link from 'next/link';
import { feedbackLoops, gateTimings } from '@wpe/shared';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Approval metrics (P2-T24, D-293): time to decision per gate and Feedback loops per artifact, from the
// timestamps already stored (artifacts, approvals, gate_feedback, prd_feedback).
export default async function MetricsPage() {
  await requireRole('owner', '/owner/metrics');
  const supabase = await createClient();
  const [projects, artifacts, approvals, feedback, clientFeedback] = await Promise.all([
    supabase.from('projects').select('id, name'),
    supabase.from('artifacts').select('id, project_id, type, version, created_at'),
    supabase.from('approvals').select('artifact_id, gate_type, role, at'),
    supabase.from('gate_feedback').select('artifact_id'),
    supabase.from('prd_feedback').select('artifact_id'),
  ]);
  for (const r of [projects, artifacts, approvals, feedback, clientFeedback])
    if (r.error) throw new Error(r.error.message);
  const timings = gateTimings(artifacts.data ?? [], approvals.data ?? []);
  const loops = feedbackLoops(artifacts.data ?? [], [
    ...(feedback.data ?? []).map((f) => ({
      artifact_id: f.artifact_id,
      source: 'feedback' as const,
    })),
    ...(clientFeedback.data ?? []).map((f) => ({
      artifact_id: f.artifact_id,
      source: 'client' as const,
    })),
  ]);
  const name = new Map((projects.data ?? []).map((p) => [p.id, p.name]));

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">Approval metrics</h1>
        <Link href="/owner" className="text-sm underline">
          Projects
        </Link>
      </div>
      <section className="mt-6">
        <h2 className="font-medium">Time to decision per gate</h2>
        <p className="text-sm text-neutral-500">
          From the version (or the gate before it) to the approval. A client gate is the time until
          you recorded the client&apos;s answer.
        </p>
        {timings.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">No approvals yet.</p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead className="text-neutral-500">
              <tr>
                <th className="py-1">Gate</th>
                <th>Decisions</th>
                <th>Median (hours)</th>
                <th>Longest (hours)</th>
              </tr>
            </thead>
            <tbody>
              {timings.map((g) => (
                <tr key={g.gate} className="border-t">
                  <td className="py-1">{g.gate.replace(/_/g, ' ')}</td>
                  <td>{g.decisions}</td>
                  <td>{g.medianHours}</td>
                  <td>{g.maxHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="mt-8">
        <h2 className="font-medium">Feedback loops per artifact</h2>
        {loops.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">
            No Feedback or client change requests yet.
          </p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead className="text-neutral-500">
              <tr>
                <th className="py-1">Project</th>
                <th>Artifact</th>
                <th>Your Feedback</th>
                <th>Client requests</th>
              </tr>
            </thead>
            <tbody>
              {loops.map((l) => (
                <tr key={`${l.project_id}-${l.type}`} className="border-t">
                  <td className="py-1">{name.get(l.project_id) ?? l.project_id}</td>
                  <td>{l.type.replace(/_/g, ' ')}</td>
                  <td>{l.feedback}</td>
                  <td>{l.client}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
