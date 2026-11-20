'use client';

import { useActionState, useState } from 'react';
import type { Plan } from '@wpe/shared';

// The owner edits the plan as text (P3-T03, D-108): each round's fields, the design brief and the rationale.
// The round count, the hard flags and the budget are the owner's to confirm (D-109, D-126).
export function PlanEditor({
  projectId,
  baseVersion,
  plan,
  action,
}: {
  projectId: string;
  baseVersion: number;
  plan: Plan;
  action: (prev: { error?: string }, formData: FormData) => Promise<{ error?: string }>;
}) {
  const [count, setCount] = useState(plan.rounds.length);
  const [state, formAction, pending] = useActionState(action, {});
  const round = (n: number) => plan.rounds[n - 1];
  const field = 'mt-1 w-full rounded border p-1.5 text-sm';
  return (
    <form action={formAction} className="mt-4 space-y-6">
      {state.error ? (
        <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="baseVersion" value={baseVersion} />
      <input type="hidden" name="rounds" value={count} />
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
        <fieldset key={n} className="rounded border p-3">
          <legend className="px-1 text-sm font-semibold">Round {n}</legend>
          <label className="block text-sm">
            Title
            <input
              name={`round_${n}_title`}
              defaultValue={round(n)?.title ?? ''}
              required
              maxLength={200}
              className={field}
            />
          </label>
          <label className="mt-2 block text-sm">
            Scope (pages and features, comma separated)
            <textarea
              name={`round_${n}_scope`}
              defaultValue={round(n)?.scope.join(', ') ?? ''}
              rows={2}
              className={field}
            />
          </label>
          <label className="mt-2 block text-sm">
            Skills (ids like seo/on-page-basics)
            <input
              name={`round_${n}_skills`}
              defaultValue={round(n)?.skills.join(', ') ?? ''}
              className={field}
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <label>
              Depends on rounds
              <input
                name={`round_${n}_depends_on`}
                defaultValue={round(n)?.depends_on.join(', ') ?? ''}
                className="ml-2 w-24 rounded border p-1"
              />
            </label>
            <label>
              Token budget
              <input
                name={`round_${n}_budget`}
                defaultValue={round(n)?.token_budget ?? 200000}
                inputMode="numeric"
                className="ml-2 w-32 rounded border p-1"
              />
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                name={`round_${n}_hard`}
                defaultChecked={round(n)?.hard ?? false}
              />{' '}
              Hard round (stronger model)
            </label>
          </div>
        </fieldset>
      ))}
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setCount(Math.min(8, count + 1))}
          className="rounded border px-3 py-1"
        >
          Add a round
        </button>
        <button
          type="button"
          onClick={() => setCount(Math.max(1, count - 1))}
          className="rounded border px-3 py-1"
        >
          Remove the last round
        </button>
      </div>
      <fieldset className="rounded border p-3">
        <legend className="px-1 text-sm font-semibold">Design brief</legend>
        {(['palette', 'fonts', 'layout', 'references'] as const).map((k) => (
          <label key={k} className="mt-2 block text-sm capitalize">
            {k}
            <textarea
              name={k}
              defaultValue={plan.design_brief[k]}
              rows={2}
              required
              className={field}
            />
          </label>
        ))}
      </fieldset>
      <fieldset className="rounded border p-3">
        <legend className="px-1 text-sm font-semibold">Rationale (markdown)</legend>
        {(['rounds', 'skills', 'budget', 'design'] as const).map((k) => (
          <label key={k} className="mt-2 block text-sm">
            Why these {k === 'design' ? 'design choices' : k}
            <textarea
              name={`why_${k}`}
              defaultValue={plan.rationale[k]}
              rows={3}
              required
              className={field}
            />
          </label>
        ))}
      </fieldset>
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
