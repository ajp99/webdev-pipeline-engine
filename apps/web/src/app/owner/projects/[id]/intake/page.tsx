import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  isAnswered,
  missingRequired,
  roundAllows,
  roundStatusLabel,
  type Answer,
  type UploadCounts,
} from '@wpe/shared';
import { IntakeQuestion } from '@/components/IntakeQuestion';
import { requireRole } from '@/lib/auth';
import { loadProjectTemplate, supabaseIntakeStore } from '@/lib/intake-store';
import { createClient } from '@/lib/supabase/server';
import {
  reopenRoundAction,
  removeUploadAction,
  saveSectionAction,
  submitRoundAction,
  unlockRoundAction,
  uploadFileAction,
} from './actions';

export const dynamic = 'force-dynamic';

const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
// Stored names are "<uuid>-<file name>": show the file name only.
const shownName = (path: string) => (path.split('/').pop() ?? path).replace(/^[0-9a-f-]{36}-/, '');

export default async function IntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string; notice?: string; error?: string }>;
}) {
  const { id } = await params;
  await requireRole('owner', `/owner/projects/${id}/intake`);
  const { section: wanted, notice, error } = await searchParams;
  const supabase = await createClient();
  const project = await loadProjectTemplate(supabase, id);
  if (!project) notFound();
  const store = supabaseIntakeStore(supabase);
  const round = await store.latestRound(id);
  if (!round) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <p className="mt-4 text-neutral-700">This project has no intake round.</p>
      </main>
    );
  }
  const [answers, counts, uploadsResult] = await Promise.all([
    store.answers(id, round.round),
    store.uploadCounts(id),
    supabase
      .from('uploads')
      .select('id, kind, storage_path, size_bytes, scan_status')
      .eq('project_id', id)
      .order('created_at'),
  ]);
  if (uploadsResult.error) throw new Error(uploadsResult.error.message);
  const uploads = uploadsResult.data;

  const sections = project.template.sections;
  const current = sections.find((s) => s.id === wanted) ?? sections[0]!;
  const open = roundAllows(round.status, 'save').ok;
  const missing = missingRequired(project.template, answers, counts as UploadCounts);
  const answeredIn = (s: (typeof sections)[number]) =>
    s.questions.filter((q) => isAnswered(q, answers[q.id], counts)).length;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <span className="text-sm text-neutral-600">
          Intake, round {round.round}: <strong>{roundStatusLabel(round.status)}</strong>
        </span>
      </div>
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
      {!open ? (
        <p className="mt-3 rounded bg-neutral-100 p-3 text-sm text-neutral-700">
          {round.status === 'submitted'
            ? 'This round is submitted. Reopen it to change answers, until the agent has reviewed it.'
            : 'The agent has reviewed this round, so it is locked. Unlock it to change answers.'}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 md:grid-cols-[14rem_1fr]">
        <nav aria-label="Intake sections" className="flex flex-col gap-1 text-sm">
          {sections.map((s) => (
            <Link
              key={s.id}
              href={`/owner/projects/${id}/intake?section=${s.id}`}
              aria-current={s.id === current.id ? 'step' : undefined}
              className={`flex justify-between rounded px-3 py-2 ${
                s.id === current.id ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100'
              }`}
            >
              <span>{s.title}</span>
              <span className="opacity-70">
                {answeredIn(s)}/{s.questions.length}
              </span>
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-6">
          <section>
            <h2 className="text-lg font-semibold">{current.title}</h2>
            {current.description ? (
              <p className="text-sm text-neutral-600">{current.description}</p>
            ) : null}
            <form action={saveSectionAction} className="mt-4 flex flex-col gap-5">
              <input type="hidden" name="projectId" value={id} />
              <input type="hidden" name="section" value={current.id} />
              {current.questions.map((q) => (
                <IntakeQuestion
                  key={q.id}
                  q={q}
                  value={answers[q.id] as Answer | null | undefined}
                  fileCount={counts[q.id] ?? 0}
                  disabled={!open}
                />
              ))}
              {open ? (
                <button
                  type="submit"
                  className="self-start rounded bg-neutral-900 px-4 py-2 text-sm text-white"
                >
                  Save this section
                </button>
              ) : null}
            </form>
          </section>

          {current.questions.some((q) => q.type === 'file_upload') ? (
            <section aria-label="Files" className="rounded border border-neutral-200 p-4">
              <h3 className="font-medium">Files</h3>
              <p className="text-xs text-neutral-600">
                Files are stored privately and are not scanned yet; no agent opens them in this
                phase.
              </p>
              {current.questions
                .filter((q) => q.type === 'file_upload')
                .map((q) => (
                  <div key={q.id} className="mt-3">
                    <p className="text-sm font-medium">{q.label}</p>
                    <ul className="mt-1 text-sm">
                      {uploads
                        .filter((u) => u.kind === q.id)
                        .map((u) => (
                          <li key={u.id} className="flex items-center gap-3 py-1">
                            <span>{shownName(u.storage_path)}</span>
                            <span className="text-neutral-500">{mb(u.size_bytes)}</span>
                            <span className="text-xs text-neutral-500">scan: {u.scan_status}</span>
                            {open ? (
                              <form action={removeUploadAction} className="ml-auto">
                                <input type="hidden" name="projectId" value={id} />
                                <input type="hidden" name="section" value={current.id} />
                                <input type="hidden" name="uploadId" value={u.id} />
                                <button type="submit" className="text-xs underline">
                                  Remove
                                </button>
                              </form>
                            ) : null}
                          </li>
                        ))}
                    </ul>
                    {open ? (
                      <form action={uploadFileAction} className="mt-1 flex items-center gap-2">
                        <input type="hidden" name="projectId" value={id} />
                        <input type="hidden" name="section" value={current.id} />
                        <input type="hidden" name="questionId" value={q.id} />
                        <input
                          type="file"
                          name="file"
                          required
                          accept={
                            q.type === 'file_upload'
                              ? q.accept.map((e) => `.${e}`).join(',')
                              : undefined
                          }
                          className="text-sm"
                        />
                        <button
                          type="submit"
                          className="rounded border border-neutral-400 px-3 py-1 text-sm"
                        >
                          Add file
                        </button>
                      </form>
                    ) : null}
                  </div>
                ))}
            </section>
          ) : null}

          <section aria-label="Round" className="rounded border border-neutral-200 p-4">
            <h3 className="font-medium">Round {round.round}</h3>
            {round.status === 'open' ? (
              <>
                {missing.length > 0 ? (
                  <div className="mt-2 text-sm">
                    <p>Still required before you can submit:</p>
                    <ul className="list-disc pl-5 text-neutral-700">
                      {missing.map((m) => (
                        <li key={m.id}>
                          {m.label} <span className="text-neutral-500">({m.section})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-neutral-700">All required answers are in.</p>
                )}
                <form action={submitRoundAction} className="mt-3">
                  <input type="hidden" name="projectId" value={id} />
                  <input type="hidden" name="section" value={current.id} />
                  <button
                    type="submit"
                    disabled={missing.length > 0}
                    className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-40"
                  >
                    Submit round
                  </button>
                </form>
              </>
            ) : null}
            {round.status === 'submitted' ? (
              <form action={reopenRoundAction} className="mt-3">
                <input type="hidden" name="projectId" value={id} />
                <input type="hidden" name="section" value={current.id} />
                <button
                  type="submit"
                  className="rounded border border-neutral-400 px-4 py-2 text-sm"
                >
                  Reopen round
                </button>
              </form>
            ) : null}
            {round.status === 'reviewed' ? (
              <form action={unlockRoundAction} className="mt-3">
                <input type="hidden" name="projectId" value={id} />
                <input type="hidden" name="section" value={current.id} />
                <button
                  type="submit"
                  className="rounded border border-neutral-400 px-4 py-2 text-sm"
                >
                  Unlock round
                </button>
              </form>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
