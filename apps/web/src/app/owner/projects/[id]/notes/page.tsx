import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MAX_NOTES_CHARS } from '@wpe/shared';
import { requireRole } from '@/lib/auth';
import { MAX_NOTE_CHARS } from '@/lib/notes';
import { createClient } from '@/lib/supabase/server';
import { addNoteAction, deleteNoteAction, saveNoteAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function NotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { id } = await params;
  await requireRole('owner', `/owner/projects/${id}/notes`);
  const { notice, error } = await searchParams;
  const supabase = await createClient();
  const project = await supabase.from('projects').select('name').eq('id', id).maybeSingle();
  if (project.error) throw new Error(project.error.message);
  if (!project.data) notFound();
  const notes = await supabase
    .from('owner_notes')
    .select('id, body, created_at, updated_at')
    .eq('project_id', id)
    .order('created_at', { ascending: false });
  if (notes.error) throw new Error(notes.error.message);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">{project.data.name}: notes</h1>
        <Link href={`/owner/projects/${id}/intake`} className="text-sm underline">
          Back to intake
        </Link>
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        Private notes. The client never sees them. Agents read them, newest first, up to about{' '}
        {MAX_NOTES_CHARS.toLocaleString('en')} characters in all, as background only; they never
        quote them to the client.
      </p>
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

      <form action={addNoteAction} className="mt-4 flex flex-col gap-2">
        <input type="hidden" name="projectId" value={id} />
        <label htmlFor="new-note" className="text-sm font-medium">
          New note
        </label>
        <textarea
          id="new-note"
          name="body"
          required
          rows={3}
          maxLength={MAX_NOTE_CHARS}
          className="rounded border border-neutral-300 p-2 text-sm"
        />
        <button
          type="submit"
          className="self-start rounded bg-neutral-900 px-4 py-2 text-sm text-white"
        >
          Add note
        </button>
      </form>

      {notes.data.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-600">No notes yet.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {notes.data.map((n) => (
            <li key={n.id} className="rounded border border-neutral-200 p-3">
              <form action={saveNoteAction} className="flex flex-col gap-2">
                <input type="hidden" name="projectId" value={id} />
                <input type="hidden" name="noteId" value={n.id} />
                <label htmlFor={`note-${n.id}`} className="text-xs text-neutral-500">
                  {new Date(n.created_at).toLocaleString('en-GB')}
                  {n.updated_at !== n.created_at ? ' (edited)' : ''}
                </label>
                <textarea
                  id={`note-${n.id}`}
                  name="body"
                  required
                  rows={3}
                  maxLength={MAX_NOTE_CHARS}
                  defaultValue={n.body}
                  className="rounded border border-neutral-300 p-2 text-sm"
                />
                <button
                  type="submit"
                  className="self-start rounded border border-neutral-400 px-3 py-1 text-sm"
                >
                  Save
                </button>
              </form>
              <form action={deleteNoteAction} className="mt-1">
                <input type="hidden" name="projectId" value={id} />
                <input type="hidden" name="noteId" value={n.id} />
                <button type="submit" className="text-xs underline">
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
