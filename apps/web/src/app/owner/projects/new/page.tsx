import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createProject } from './actions';

export const dynamic = 'force-dynamic';

export default async function NewProject({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole('owner', '/owner/projects/new');
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data, error: loadError } = await supabase
    .from('intake_templates')
    .select('industry, version')
    .eq('status', 'approved')
    .order('industry')
    .order('version', { ascending: false });
  if (loadError) throw new Error(loadError.message);
  // The latest approved version of each industry.
  const industries = [...new Map((data ?? []).map((t) => [t.industry, t.version])).entries()];
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">New project</h1>
      <p className="mt-1 text-sm text-neutral-600">
        You fill in the intake yourself from the client&apos;s email or call. The project keeps the
        template version it starts with.
      </p>
      {error ? (
        <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {industries.length === 0 ? (
        <p className="mt-4 text-neutral-700">
          No approved intake template yet. Run <code>pnpm --filter @wpe/worker load-template</code>.
        </p>
      ) : (
        <form action={createProject} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Project name
            <input
              name="name"
              required
              maxLength={120}
              className="rounded border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Industry
            <select name="industry" className="rounded border border-neutral-300 px-3 py-2">
              {industries.map(([industry, version]) => (
                <option key={industry} value={industry}>
                  {industry} (version {version})
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="self-start rounded bg-neutral-900 px-4 py-2 text-sm text-white"
          >
            Create project
          </button>
        </form>
      )}
    </main>
  );
}
