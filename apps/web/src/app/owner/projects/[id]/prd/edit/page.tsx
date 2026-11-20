import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asPrd, type PrdContent } from '@wpe/shared';
import { PrdEditor } from '@/components/PrdEditor';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { savePrd } from '../actions';

export const dynamic = 'force-dynamic';

const EMPTY: PrdContent = {
  sections: {
    business: '',
    site_map: '- Home\n- Privacy policy\n- Cookie notice',
    features: '',
    content: '',
    brand: '',
    non_functional: 'Lighthouse 80+, basic SEO, responsive, accessibility basics.',
  },
  spam_protection: 'honeypot',
  change_summary: '',
};

// Edit the PRD (P2-T08): in the requirements stage a new draft; after the sign-off only for an accepted change
// request (?cr=...), which the database checks again.
export default async function EditPrdPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cr?: string; error?: string }>;
}) {
  const { id } = await params;
  await requireRole('owner', `/owner/projects/${id}/prd/edit`);
  const { cr, error } = await searchParams;
  const supabase = await createClient();
  const project = await supabase
    .from('projects')
    .select('name, stage, status')
    .eq('id', id)
    .maybeSingle();
  if (project.error) throw new Error(project.error.message);
  if (!project.data) notFound();
  const newest = await supabase
    .from('artifacts')
    .select('version, content')
    .eq('project_id', id)
    .eq('type', 'prd')
    .order('version', { ascending: false })
    .limit(1);
  if (newest.error) throw new Error(newest.error.message);
  const row = newest.data?.[0];
  // While the requirements agent drafts, the database refuses an owner save (it would be superseded).
  const active = await supabase
    .from('stage_runs')
    .select('id')
    .eq('project_id', id)
    .eq('stage', 'requirements')
    .in('status', ['queued', 'running', 'waiting'])
    .limit(1);
  if (active.error) throw new Error(active.error.message);
  const agentBusy = (active.data ?? []).length > 0;
  const previous = row ? asPrd(row.content) : null;
  let request: { id: string; description: string } | null = null;
  if (cr) {
    const r = await supabase
      .from('change_requests')
      .select('id, description, status')
      .eq('id', cr)
      .eq('project_id', id)
      .maybeSingle();
    if (r.error) throw new Error(r.error.message);
    if (r.data?.status === 'accepted') request = { id: r.data.id, description: r.data.description };
  }
  const editable =
    project.data.status === 'active' && (project.data.stage === 'requirements' || request !== null);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">{project.data.name}: edit the PRD</h1>
        <Link href={`/owner/projects/${id}/prd`} className="text-sm underline">
          Back to the PRD
        </Link>
      </div>
      {error ? <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {request ? (
        <p className="mt-3 rounded bg-neutral-50 p-3 text-sm">
          For the accepted change request: {request.description}
        </p>
      ) : null}
      {agentBusy ? (
        <p role="status" className="mt-3 rounded bg-amber-50 p-3 text-sm">
          The requirements agent is drafting the PRD. Wait for its run to finish (or cancel it on
          the stage page), then reload this page to edit its version.
        </p>
      ) : null}
      {agentBusy ? null : !editable ? (
        <p className="mt-6 text-sm text-neutral-600">
          The PRD can be edited in the requirements stage, or after the sign-off for an accepted
          change request.
        </p>
      ) : row && !previous ? (
        <p className="mt-6 text-sm text-red-800">
          The newest version is not in the PRD shape and cannot be edited here.
        </p>
      ) : (
        <PrdEditor
          projectId={id}
          baseVersion={row?.version ?? 0}
          start={previous ?? EMPTY}
          previous={previous}
          changeRequestId={request?.id ?? null}
          action={savePrd}
        />
      )}
    </main>
  );
}
