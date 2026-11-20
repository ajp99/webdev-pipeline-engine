// The owner's plan editor and the Phase 3 approval helpers (P3-T03, P3-T06, P3-T08): pure, so they are tested
// without a database.
import { planProblem, type Plan, type PlanRound } from '@wpe/shared';

export type FormValues = Record<string, string | undefined>;

const list = (v: string | undefined) =>
  (v ?? '')
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * The editor's form as a plan. Rounds are fields round_<n>_title, _scope, _skills (comma or line separated),
 * _depends_on (round numbers), _hard ("on"), _budget; the count is `rounds`. The total is computed here.
 */
export function planFromForm(
  f: FormValues,
): { ok: true; plan: Plan } | { ok: false; error: string } {
  const count = Number(f.rounds);
  if (!Number.isInteger(count) || count < 1 || count > 8)
    return { ok: false, error: 'A plan has 1 to 8 rounds.' };
  const rounds: PlanRound[] = [];
  for (let n = 1; n <= count; n++) {
    const deps = list(f[`round_${n}_depends_on`]).map(Number);
    if (deps.some((d) => !Number.isInteger(d)))
      return { ok: false, error: `Round ${n}: depends on takes round numbers.` };
    rounds.push({
      number: n,
      title: (f[`round_${n}_title`] ?? '').trim(),
      scope: list(f[`round_${n}_scope`]),
      skills: [...new Set(list(f[`round_${n}_skills`]))],
      depends_on: deps,
      hard: f[`round_${n}_hard`] === 'on',
      token_budget: Number((f[`round_${n}_budget`] ?? '').replace(/[\s,_]/g, '')),
    });
  }
  const plan: Plan = {
    rounds,
    total_token_budget: rounds.reduce(
      (s, r) => s + (Number.isFinite(r.token_budget) ? r.token_budget : 0),
      0,
    ),
    design_brief: {
      palette: (f.palette ?? '').trim(),
      fonts: (f.fonts ?? '').trim(),
      layout: (f.layout ?? '').trim(),
      references: (f.references ?? '').trim(),
    },
    rationale: {
      rounds: (f.why_rounds ?? '').trim(),
      skills: (f.why_skills ?? '').trim(),
      budget: (f.why_budget ?? '').trim(),
      design: (f.why_design ?? '').trim(),
    },
  };
  const problem = planProblem(plan);
  return problem ? { ok: false, error: `The plan is not valid: ${problem}.` } : { ok: true, plan };
}

/** The skills an artifact used, for the owner's optional marks at the gate (P3-T08). */
export function skillsUsed(type: string, content: unknown): string[] {
  if (type === 'plan' && planProblem(content) === null)
    return [...new Set((content as Plan).rounds.flatMap((r) => r.skills))].sort();
  const skills = (content as { skills?: unknown } | null)?.skills;
  if (type === 'prototype' && Array.isArray(skills))
    return skills.filter((s): s is string => typeof s === 'string');
  return [];
}

export const SKILL_MARKS = ['good', 'bad'] as const;

/** The marks the owner set in the form (skill_<id>=good|bad); unmarked skills are left out (they do not count). */
export function marksFromForm(
  f: FormValues,
  skills: string[],
): { skill: string; mark: 'good' | 'bad' }[] {
  return skills.flatMap((s) => {
    const m = f[`mark_${s}`];
    return m === 'good' || m === 'bad' ? [{ skill: s, mark: m }] : [];
  });
}

export const NOTE_ACTIONS = ['forward', 'change_request', 'dismiss'] as const;
export type NoteAction = (typeof NOTE_ACTIONS)[number];

/** The comment disposition each action records (P3-T06). */
export const DISPOSITION: Record<NoteAction, 'forwarded' | 'change_request' | 'ignored'> = {
  forward: 'forwarded',
  change_request: 'change_request',
  dismiss: 'ignored',
};
