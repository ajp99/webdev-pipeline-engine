// The plan artifact (P3-T03, D-108, D-109, D-126, D-135): structured rounds the worker can act on, plus a
// markdown rationale per section the owner edits as text, and the design brief the Prototype agent builds from.
// `planProblem` is the shape check used by the Planner's reply check, the console and the eval harness.

export type PlanRound = {
  /** 1, 2, ... in order. */
  number: number;
  title: string;
  /** Pages and features this round builds, by the names the PRD uses. */
  scope: string[];
  /** Skill ids ("area/name") the worker loads for this round; only these are loaded (D-282). */
  skills: string[];
  /** Earlier rounds this one needs. */
  depends_on: number[];
  /** Flagged for Opus 5.5 (D-108); the owner confirms when approving the plan. */
  hard: boolean;
  token_budget: number;
};

export type Plan = {
  rounds: PlanRound[];
  /** The sum of the rounds' budgets; the owner confirms it at the plan gate (D-109). */
  total_token_budget: number;
  design_brief: { palette: string; fonts: string; layout: string; references: string };
  rationale: { rounds: string; skills: string; budget: string; design: string };
};

export const PLAN_MAX_ROUNDS = 8;
export const ROUND_BUDGET_MIN = 50_000;
export const ROUND_BUDGET_MAX = 2_000_000;
const TEXT_MAX = 10_000;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const hasText = (v: unknown): v is string => typeof v === 'string' && /\S/.test(v);
const strings = (v: unknown, max: number) =>
  Array.isArray(v) && v.length <= max && v.every((x) => hasText(x) && x.length <= 200);

/** Null when the content is a valid plan, or the problem. A stored version may also carry `model`. */
export function planProblem(c: unknown): string | null {
  if (!isObject(c)) return 'the plan must be an object';
  if (
    Object.keys(c).some(
      (k) => !['rounds', 'total_token_budget', 'design_brief', 'rationale', 'model'].includes(k),
    )
  )
    return 'the plan has a key other than rounds, total_token_budget, design_brief and rationale';
  const rounds = c.rounds;
  if (!Array.isArray(rounds) || rounds.length === 0 || rounds.length > PLAN_MAX_ROUNDS)
    return `the plan needs 1 to ${PLAN_MAX_ROUNDS} rounds`;
  let sum = 0;
  for (const [i, r] of rounds.entries()) {
    const where = `round ${i + 1}`;
    if (!isObject(r)) return `${where} must be an object`;
    if (r.number !== i + 1) return `${where} must have number ${i + 1}`;
    if (!hasText(r.title) || r.title.length > 200) return `${where} needs a title`;
    if (!strings(r.scope, 50) || (r.scope as string[]).length === 0)
      return `${where} needs a scope list`;
    if (!strings(r.skills, 30)) return `${where} needs a skills list (ids like area/name)`;
    if ((r.skills as string[]).some((s) => !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(s)))
      return `${where} has a skill id that is not area/name`;
    if (
      !Array.isArray(r.depends_on) ||
      !r.depends_on.every((d) => Number.isInteger(d) && (d as number) >= 1 && (d as number) < i + 1)
    )
      return `${where} may depend only on earlier rounds`;
    if (typeof r.hard !== 'boolean') return `${where} needs hard: true or false`;
    if (
      !Number.isInteger(r.token_budget) ||
      (r.token_budget as number) < ROUND_BUDGET_MIN ||
      (r.token_budget as number) > ROUND_BUDGET_MAX
    )
      return `${where} needs a token budget from ${ROUND_BUDGET_MIN} to ${ROUND_BUDGET_MAX}`;
    if (
      Object.keys(r).some(
        (k) =>
          !['number', 'title', 'scope', 'skills', 'depends_on', 'hard', 'token_budget'].includes(k),
      )
    )
      return `${where} has an unknown key`;
    sum += r.token_budget as number;
  }
  if (c.total_token_budget !== sum)
    return "total_token_budget must be the sum of the rounds' budgets";
  for (const [key, fields] of [
    ['design_brief', ['palette', 'fonts', 'layout', 'references']],
    ['rationale', ['rounds', 'skills', 'budget', 'design']],
  ] as const) {
    const o = c[key];
    if (!isObject(o) || Object.keys(o).some((k) => !(fields as readonly string[]).includes(k)))
      return `${key} needs exactly ${fields.join(', ')}`;
    for (const f of fields)
      if (!hasText(o[f]) || (o[f] as string).length > TEXT_MAX)
        return `${key}.${f} is missing or too long`;
  }
  return null;
}

/**
 * The rule of thumb (D-126): 5 pages or fewer and no blog is 2 rounds, otherwise 4. The privacy policy and the
 * cookie notice come from the starter's templates and do not count as pages.
 */
export function ruleOfThumbRounds(pages: string[], hasBlog: boolean): 2 | 4 {
  const counted = pages.filter((p) => !/privacy|cookie/i.test(p));
  return counted.length <= 5 && !hasBlog ? 2 : 4;
}

/** Page names from a PRD site map written as a markdown list ("- Home (/)", "* About: who we are"). */
export function pagesFromSiteMap(siteMap: string): string[] {
  return siteMap
    .split('\n')
    .map((l) => /^\s*[-*]\s+(.+)$/.exec(l)?.[1])
    .filter((x): x is string => Boolean(x))
    .map((x) =>
      x
        .replace(/\s*\(.*?\)\s*/g, ' ')
        .split(/[:–—-]\s/)[0]!
        .trim(),
    )
    .filter(Boolean);
}
