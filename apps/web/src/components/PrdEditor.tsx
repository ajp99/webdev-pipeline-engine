'use client';

import { useActionState, useState } from 'react';
import Markdown from 'react-markdown';
import { PRD_SECTIONS, prdProblem, SPAM_PROTECTION, type PrdContent } from '@wpe/shared';
import { defaultSummary } from '@/lib/prd-view';

// The PRD editor (P2-T08): one markdown text area per section with a live preview, the spam protection, and
// the change summary, prefilled with the changed sections until the owner writes their own (D-324).
export function PrdEditor({
  projectId,
  baseVersion,
  start,
  previous,
  changeRequestId,
  action,
}: {
  projectId: string;
  baseVersion: number;
  start: PrdContent;
  previous: PrdContent | null;
  changeRequestId: string | null;
  action: (prev: { error?: string }, formData: FormData) => Promise<{ error?: string }>;
}) {
  const [sections, setSections] = useState(start.sections);
  const [spam, setSpam] = useState(start.spam_protection);
  const [summary, setSummary] = useState<string | null>(null);
  // Errors from the server come back here; the fields are controlled, so the owner's edits stay.
  const [state, formAction, pending] = useActionState(action, {});
  const [localError, setLocalError] = useState<string | null>(null);
  // Cheap to recompute: six string comparisons.
  const suggested = defaultSummary(previous, {
    sections,
    spam_protection: spam,
    change_summary: '',
  });

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        // The same check as the database, before anything is sent (D-325).
        const problem = prdProblem({
          sections,
          spam_protection: spam,
          change_summary: summary ?? suggested,
        });
        const empty = !/\S/.test(summary ?? suggested);
        setLocalError(problem ?? (empty ? 'Write a short summary of what changed.' : null));
        if (problem || empty) e.preventDefault();
      }}
      className="mt-4 space-y-6"
    >
      {(localError ?? state.error) ? (
        <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">
          {localError ?? state.error}
        </p>
      ) : null}
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="baseVersion" value={baseVersion} />
      {changeRequestId ? (
        <input type="hidden" name="changeRequestId" value={changeRequestId} />
      ) : null}
      {PRD_SECTIONS.map((s) => (
        <div key={s.key}>
          <label htmlFor={`section_${s.key}`} className="text-sm font-semibold">
            {s.title}
          </label>
          <div className="mt-1 grid gap-3 md:grid-cols-2">
            <textarea
              id={`section_${s.key}`}
              name={`section_${s.key}`}
              rows={8}
              maxLength={20000}
              required
              value={sections[s.key]}
              onChange={(e) => setSections({ ...sections, [s.key]: e.target.value })}
              className="w-full rounded border p-2 font-mono text-xs"
            />
            <div
              className="md rounded border bg-neutral-50 p-2 text-sm"
              aria-label={`${s.title} preview`}
            >
              <Markdown>{sections[s.key]}</Markdown>
            </div>
          </div>
          {s.key === 'site_map' ? (
            <p className="mt-1 text-xs text-neutral-500">
              Must list a privacy policy and a cookie notice.
            </p>
          ) : null}
        </div>
      ))}
      <label className="block text-sm">
        <span className="font-semibold">Contact form spam protection</span>
        <select
          name="spam_protection"
          value={spam}
          onChange={(e) => setSpam(e.target.value as PrdContent['spam_protection'])}
          className="ml-2 rounded border p-1"
        >
          {SPAM_PROTECTION.map((v) => (
            <option key={v} value={v}>
              {v.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-semibold">What changed (the client sees this)</span>
        <textarea
          name="change_summary"
          rows={2}
          maxLength={1000}
          required
          value={summary ?? suggested}
          onChange={(e) => setSummary(e.target.value)}
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
      >
        Save as a new version
      </button>
    </form>
  );
}
