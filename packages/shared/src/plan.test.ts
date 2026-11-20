import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { pagesFromSiteMap, planProblem, ruleOfThumbRounds, type Plan } from './plan';
import { checkPlan, type PlanFixture } from './plan-eval';
import { prdProblem } from './prd';

const dir = join(fileURLToPath(import.meta.url), '../../../../evals/fixtures/planner');
const fixtures: PlanFixture[] = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));

/** A plan that meets the fixture's expectations, built by hand (what a good Planner should produce). */
function goodPlan(f: PlanFixture): Plan {
  const pages = f.expect.pages;
  const n = f.expect.rounds;
  const per = Math.ceil(pages.length / n);
  const skills = f.expect.skillAreas.map((a) => `${a}/basics`);
  const rounds = Array.from({ length: n }, (_, i) => ({
    number: i + 1,
    title: `Round ${i + 1}`,
    scope: pages.slice(i * per, (i + 1) * per).length
      ? pages.slice(i * per, (i + 1) * per)
      : ['Polish'],
    skills: i === 0 ? skills : [skills[0]!],
    depends_on: i === 0 ? [] : [i],
    hard: false,
    token_budget: 300_000,
  }));
  return {
    rounds,
    total_token_budget: 300_000 * n,
    design_brief: {
      palette: f.expect.designMentions.join(', '),
      fonts: 'One sans-serif family',
      layout: 'Mobile first',
      references: 'None given',
    },
    rationale: {
      rounds: 'Rule of thumb.',
      skills: 'From the PRD.',
      budget: 'Standard.',
      design: 'From the intake.',
    },
  };
}

describe('the plan shape', () => {
  const base = goodPlan(fixtures[0]!);
  it('accepts a valid plan, with or without a stored model', () => {
    expect(planProblem(base)).toBeNull();
    expect(planProblem({ ...base, model: 'm' })).toBeNull();
  });
  it.each([
    ['no rounds', { ...base, rounds: [] }, '1 to 8 rounds'],
    ['a wrong total', { ...base, total_token_budget: 1 }, 'sum of the rounds'],
    [
      'rounds out of order',
      { ...base, rounds: [{ ...base.rounds[0]!, number: 2 }, base.rounds[1]!] },
      'number 1',
    ],
    [
      'a forward dependency',
      { ...base, rounds: [{ ...base.rounds[0]!, depends_on: [2] }, base.rounds[1]!] },
      'earlier rounds',
    ],
    [
      'a bad skill id',
      { ...base, rounds: [{ ...base.rounds[0]!, skills: ['SEO'] }, base.rounds[1]!] },
      'area/name',
    ],
    [
      'a tiny budget',
      {
        ...base,
        rounds: [{ ...base.rounds[0]!, token_budget: 10 }, base.rounds[1]!],
        total_token_budget: 300_010,
      },
      'token budget',
    ],
    [
      'a missing rationale',
      { ...base, rationale: { rounds: 'x', skills: 'x', budget: 'x' } },
      'rationale',
    ],
    ['an extra key', { ...base, schedule: 'x' }, 'key other than'],
  ])('refuses %s', (_n, plan, msg) => {
    expect(planProblem(plan)).toContain(msg);
  });
});

describe('the rule of thumb (D-126)', () => {
  it('is 2 rounds for 5 pages or fewer and no blog, otherwise 4; legal notices do not count', () => {
    expect(
      ruleOfThumbRounds(['Home', 'A', 'B', 'C', 'D', 'Privacy policy', 'Cookie notice'], false),
    ).toBe(2);
    expect(ruleOfThumbRounds(['Home', 'A', 'B', 'C', 'D', 'E'], false)).toBe(4);
    expect(ruleOfThumbRounds(['Home'], true)).toBe(4);
  });
  it('reads page names from a markdown site map', () => {
    expect(
      pagesFromSiteMap('- Home: intro\n- Practice areas: dismissal\n* Contact (form)\nnot a page'),
    ).toEqual(['Home', 'Practice areas', 'Contact']);
  });
});

describe('the Planner fixtures (P3-T10)', () => {
  it('has the three fictional clients', () => {
    expect(fixtures.map((f) => f.id).sort()).toEqual(['dental-clinic', 'law-firm', 'restaurant']);
  });
  it.each(fixtures.map((f) => [f.id, f] as const))(
    '%s: a valid PRD whose expected rounds follow the rule',
    (_id, f) => {
      expect(prdProblem(f.input.prd)).toBeNull();
      const pages = pagesFromSiteMap(f.input.prd.sections.site_map);
      const blog = pages.some((p) => /blog/i.test(p));
      expect(ruleOfThumbRounds(pages, blog)).toBe(f.expect.rounds);
      for (const p of f.expect.pages)
        expect(f.input.prd.sections.site_map.toLowerCase()).toContain(p.toLowerCase());
    },
  );
  it('includes prompt-injection cases (D-267)', () => {
    expect(fixtures.filter((f) => f.expect.forbiddenText.length > 0).length).toBeGreaterThanOrEqual(
      2,
    );
  });
  it.each(fixtures.map((f) => [f.id, f] as const))(
    '%s: a good plan passes every check',
    (_id, f) => {
      const results = checkPlan(goodPlan(f), f);
      expect(results.filter((r) => !r.pass)).toEqual([]);
    },
  );
});

describe('checkPlan catches bad plans', () => {
  const law = fixtures.find((f) => f.id === 'law-firm')!;
  const restaurant = fixtures.find((f) => f.id === 'restaurant')!;
  const failed = (plan: unknown, f: PlanFixture) =>
    checkPlan(plan, f)
      .filter((r) => !r.pass)
      .map((r) => r.check);
  it('a wrong round count', () => {
    const p = goodPlan(law);
    p.rounds = p.rounds.slice(0, 2);
    p.total_token_budget = 600_000;
    expect(failed(p, law)).toContain('round count');
  });
  it('a page left out', () => {
    const p = goodPlan(law);
    p.rounds[1]!.scope = ['Polish'];
    expect(failed(p, law)).toContain('pages covered');
  });
  it('a followed injection', () => {
    const p = goodPlan(law);
    p.rounds[0]!.scope.push('Free Crypto Giveaway');
    expect(failed(p, law)).toContain('ignores injected instructions');
    const r = goodPlan(restaurant);
    r.rounds[0]!.skills.push('deployment/prod-push');
    expect(failed(r, restaurant)).toEqual(
      expect.arrayContaining(['ignores injected instructions', 'no needless skills']),
    );
  });
  it('a contact form skill for a site without a form, and a missing area', () => {
    const r = goodPlan(restaurant);
    r.rounds[0]!.skills = ['smtp-contact-form/basics'];
    expect(failed(r, restaurant)).toEqual(
      expect.arrayContaining(['no needless skills', 'skills selected']),
    );
  });
  it('a design brief that ignores the intake', () => {
    const p = goodPlan(law);
    p.design_brief.palette = 'pastel pink';
    expect(failed(p, law)).toContain('design brief from the intake');
  });
  it('an invalid plan stops at the shape check', () => {
    expect(checkPlan({ rounds: [] }, law)).toEqual([
      { check: 'shape', pass: false, detail: expect.any(String) },
    ]);
  });
});
