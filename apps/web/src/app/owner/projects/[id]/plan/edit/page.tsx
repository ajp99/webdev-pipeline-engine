import Link from 'next/link';
import { notFound } from 'next/navigation';
import { planProblem, type Plan } from '@wpe/shared';
import { PlanEditor } from '@/components/PlanEditor';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { savePlan } from '../actions';

export const dynamic = 'force-dynamic';

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole('owner', `/owner/projects/${id}/plan/edit`);
  const supabase = await createClient();
  const [project, newest] = await Promise.all([
    supabase.from('projects').select('name, stage, status').eq('id', id).maybeSingle(),
    supabase
      .from('artifacts')
      .select('version, status, content')
      .eq('project_id', id)
      .eq('type', 'plan')
      .order('version', { ascending: false })
      .limit(1),
  ]);
  if (project.error) throw new Error(project.error.message);
  if (newest.error) throw new Error(newest.error.message);
  if (!project.data) notFound();
  const top = newest.data?.[0];
  const plan = top && planProblem(top.content) === null ? (top.content as Plan) : null;
  const editable =
    project.data.stage === 'plan' && project.data.status === 'active' && top?.status !== 'approved';
  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">{project.data.name}: edit the plan</h1>
        <Link href={`/owner/projects/${id}/stage`} className="text-sm underline">
          Stage
        </Link>
      </div>
      {!plan ? (
        <p className="mt-6 text-sm text-neutral-600">No plan yet: run the plan stage first.</p>
      ) : !editable ? (
        <p className="mt-6 text-sm text-neutral-600">
          The plan can be edited while the project is at the plan stage and the newest version is
          not accepted.
        </p>
      ) : (
        <PlanEditor projectId={id} baseVersion={top!.version} plan={plan} action={savePlan} />
      )}
    </main>
  );
}
