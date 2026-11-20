import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asPrd, PRD_SECTIONS } from '@wpe/shared';
import { requireRole } from '@/lib/auth';
import { lineDiff } from '@/lib/prd-view';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CELL = {
  same: '',
  del: 'bg-red-50 text-red-900',
  add: 'bg-emerald-50 text-emerald-900',
} as const;

// Side-by-side diff of two PRD versions, section by section (P2-T08). Left: the older version; right: the newer.
export default async function ComparePrdPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { id } = await params;
  await requireRole('owner', `/owner/projects/${id}/prd/compare`);
  const { a, b } = await searchParams;
  const va = Number(a);
  const vb = Number(b);
  if (!Number.isInteger(va) || !Number.isInteger(vb)) notFound();
  const supabase = await createClient();
  const rows = await supabase
    .from('artifacts')
    .select('version, content')
    .eq('project_id', id)
    .eq('type', 'prd')
    .in('version', [va, vb]);
  if (rows.error) throw new Error(rows.error.message);
  const left = asPrd(rows.data?.find((r) => r.version === va)?.content);
  const right = asPrd(rows.data?.find((r) => r.version === vb)?.content);
  if (!left || !right) notFound();

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">
          PRD version {va} → version {vb}
        </h1>
        <Link href={`/owner/projects/${id}/prd`} className="text-sm underline">
          Back to the PRD
        </Link>
      </div>
      {right.change_summary ? (
        <p className="mt-3 rounded bg-neutral-50 p-3 text-sm">
          What changed: {right.change_summary}
        </p>
      ) : null}
      {[
        ...PRD_SECTIONS.map((s) => ({
          title: s.title,
          x: left.sections[s.key],
          y: right.sections[s.key],
        })),
        {
          title: 'Contact form spam protection',
          x: left.spam_protection,
          y: right.spam_protection,
        },
      ].map((s) => {
        const diff = lineDiff(s.x, s.y);
        const changed = diff.some((d) => d.kind !== 'same');
        return (
          <section key={s.title} className="mt-6">
            <h2 className="text-sm font-semibold">
              {s.title}{' '}
              {changed ? null : <span className="font-normal text-neutral-500">(unchanged)</span>}
            </h2>
            {changed ? (
              <div className="mt-1 grid grid-cols-2 gap-2 font-mono text-xs">
                <pre className="overflow-x-auto rounded border p-2 whitespace-pre-wrap">
                  {diff
                    .filter((d) => d.kind !== 'add')
                    .map((d, i) => (
                      <div key={i} className={CELL[d.kind]}>
                        {d.kind === 'del' ? '- ' : '  '}
                        {d.text}
                      </div>
                    ))}
                </pre>
                <pre className="overflow-x-auto rounded border p-2 whitespace-pre-wrap">
                  {diff
                    .filter((d) => d.kind !== 'del')
                    .map((d, i) => (
                      <div key={i} className={CELL[d.kind]}>
                        {d.kind === 'add' ? '+ ' : '  '}
                        {d.text}
                      </div>
                    ))}
                </pre>
              </div>
            ) : null}
          </section>
        );
      })}
    </main>
  );
}
