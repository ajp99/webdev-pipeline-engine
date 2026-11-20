import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { cancelBlocked, MAX_CANCEL_REASON_CHARS } from '@/lib/cancel-project';
import { createClient } from '@/lib/supabase/server';
import { cancelProjectAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function CancelProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  await requireRole('owner', `/owner/projects/${id}/cancel`);
  const { error } = await searchParams;
  const supabase = await createClient();
  const [project, internal] = await Promise.all([
    supabase
      .from('projects')
      .select('name, stage, status, close_reason')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('project_internal').select('cancel_reason').eq('project_id', id).maybeSingle(),
  ]);
  if (project.error) throw new Error(project.error.message);
  if (internal.error) throw new Error(internal.error.message);
  if (!project.data) notFound();
  const p = project.data;
  const blocked = cancelBlocked(p.status, p.stage);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold">{p.name}: cancel project</h1>
      <p className="mt-1 text-sm">
        <Link href={`/owner/projects/${id}/intake`} className="underline">
          Back to intake
        </Link>
      </p>
      {error ? (
        <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {p.status === 'closed' && p.close_reason === 'cancelled' ? (
        <section className="mt-4 rounded border border-neutral-200 p-4 text-sm">
          <p>
            <strong>Cancelled.</strong> The project was stopped in its {p.stage.replace('_', ' ')}{' '}
            stage and its data is kept.
          </p>
          {internal.data?.cancel_reason ? (
            <p className="mt-2 whitespace-pre-wrap">Reason: {internal.data.cancel_reason}</p>
          ) : null}
        </section>
      ) : blocked ? (
        <p className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-900">{blocked}</p>
      ) : (
        <>
          <ul className="mt-4 list-disc pl-5 text-sm text-neutral-700">
            <li>
              Queued runs are cancelled at once. Running runs are asked to stop at their next check.
            </li>
            <li>The project is closed. It stays in the {p.stage.replace('_', ' ')} stage.</li>
            <li>All its data is kept. You cannot undo this.</li>
          </ul>
          <form action={cancelProjectAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="projectId" value={id} />
            <label htmlFor="typed-name" className="text-sm font-medium">
              Type the project name to confirm: <span className="font-mono">{p.name}</span>
            </label>
            <input
              id="typed-name"
              name="typedName"
              required
              autoComplete="off"
              className="rounded border border-neutral-300 p-2 text-sm"
            />
            <label htmlFor="reason" className="text-sm font-medium">
              Reason (required)
            </label>
            <textarea
              id="reason"
              name="reason"
              required
              rows={3}
              maxLength={MAX_CANCEL_REASON_CHARS}
              className="rounded border border-neutral-300 p-2 text-sm"
            />
            <button
              type="submit"
              className="self-start rounded bg-red-700 px-4 py-2 text-sm text-white"
            >
              Cancel this project
            </button>
          </form>
        </>
      )}
    </main>
  );
}
