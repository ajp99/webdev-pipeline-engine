import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  answerProblem,
  isAnswered,
  missingRequired,
  roundAllows,
  unansweredExpected,
  type Answers,
} from './intake';
import { validateTemplate, type IntakeTemplate, type TemplateQuestion } from './template';

const root = join(fileURLToPath(import.meta.url), '../../../..');
const check = validateTemplate(
  JSON.parse(readFileSync(join(root, 'templates/intake/generic.v1.json'), 'utf8')),
);
if (!check.ok) throw new Error(check.errors.join('\n'));
const generic: IntakeTemplate = check.template;
const q = (id: string): TemplateQuestion => {
  const found = generic.sections.flatMap((s) => s.questions).find((x) => x.id === id);
  if (!found) throw new Error(`no question ${id}`);
  return found;
};
const REQUIRED = [
  'business_name',
  'what_you_do',
  'contact_email',
  'site_goal',
  'main_audience',
  'pages_wanted',
  'copy_status',
  'design_style_cards',
  'layout_density',
];

describe('missingRequired', () => {
  it('lists every required question of the generic template when nothing is answered', () => {
    expect(missingRequired(generic, {}).map((m) => m.id)).toEqual(REQUIRED);
  });

  it('names the section, so the console can show where to go', () => {
    const m = missingRequired(generic, {}).find((x) => x.id === 'layout_density');
    expect(m?.section).toBe('Design');
  });

  it('does not list optional questions', () => {
    const ids = missingRequired(generic, {}).map((m) => m.id);
    expect(ids).not.toContain('location');
    expect(ids).not.toContain('brand_guideline');
  });

  it('treats blank or whitespace text as unanswered', () => {
    expect(isAnswered(q('business_name'), '   ', {})).toBe(false);
    expect(isAnswered(q('business_name'), 'Acme', {})).toBe(true);
  });

  it('treats an empty list as unanswered', () => {
    expect(isAnswered(q('pages_wanted'), [], {})).toBe(false);
  });

  it('accepts an uploaded logo, or an explicit "none" only where the template allows it', () => {
    expect(isAnswered(q('logo'), undefined, { logo: 1 })).toBe(true);
    expect(isAnswered(q('logo'), { none: true }, {})).toBe(true);
    const noNone = { ...q('logo'), none_allowed: false } as TemplateQuestion;
    expect(isAnswered(noNone, { none: true }, {})).toBe(false);
  });

  it('is empty once every required question is answered', () => {
    const answers: Answers = {
      business_name: 'Acme',
      what_you_do: 'Plumbing',
      contact_email: 'a@b.co',
      site_goal: (q('site_goal') as { options: { value: string }[] }).options[0]!.value,
      main_audience: 'Homeowners',
      pages_wanted: [(q('pages_wanted') as { options: { value: string }[] }).options[0]!.value],
      copy_status: (q('copy_status') as { options: { value: string }[] }).options[0]!.value,
      design_style_cards: [
        (q('design_style_cards') as { options: { value: string }[] }).options[0]!.value,
      ],
      layout_density: (q('layout_density') as { options: { value: string }[] }).options[0]!.value,
      logo: { none: true },
    };
    expect(missingRequired(generic, answers)).toEqual([]);
  });
});

describe('unansweredExpected (P2-T15)', () => {
  it('warns about a logo with neither a file nor "none", and does not block Submit', () => {
    expect(unansweredExpected(generic, {}).map((m) => m.id)).toEqual(['logo']);
    expect(missingRequired(generic, {}).map((m) => m.id)).not.toContain('logo');
  });
  it('is quiet once the logo is uploaded or marked "none"', () => {
    expect(unansweredExpected(generic, {}, { logo: 1 })).toEqual([]);
    expect(unansweredExpected(generic, { logo: { none: true } })).toEqual([]);
  });
  it('names the section', () => {
    expect(unansweredExpected(generic, {})[0]?.section).toBe('Design');
  });
});

describe('answerProblem', () => {
  it('lets an answer be cleared', () => {
    expect(answerProblem(q('business_name'), null)).toBeNull();
  });

  it('rejects text that is too long and a wrong type', () => {
    expect(answerProblem(q('business_name'), 'x'.repeat(301))).toMatch(/longer than 300/);
    expect(answerProblem(q('business_name'), 5)).toMatch(/text/);
  });

  it('rejects an option that is not on the list', () => {
    expect(answerProblem(q('site_goal'), 'nonsense')).toMatch(/listed options/);
    expect(answerProblem(q('pages_wanted'), ['nonsense'])).toMatch(/listed options/);
  });

  it('enforces max_selections and rejects duplicates', () => {
    const multi = {
      ...q('pages_wanted'),
      max_selections: 1,
    } as TemplateQuestion & { options: { value: string }[] };
    const [a, b] = multi.options.map((o) => o.value);
    expect(answerProblem(multi, [a!, b!])).toMatch(/at most 1/);
    expect(answerProblem(multi, [a!, a!])).toMatch(/twice/);
  });

  it('accepts only http and https links, within the link cap', () => {
    const l = q('reference_sites');
    expect(answerProblem(l, [{ url: 'javascript:alert(1)' }])).toMatch(/not a web address/);
    expect(answerProblem(l, [{ url: 'ftp://x.test' }])).toMatch(/not a web address/);
    expect(answerProblem(l, [{ url: 'https://example.com', note: 'nice' }])).toBeNull();
    const many = Array.from({ length: 11 }, () => ({ url: 'https://example.com' }));
    expect(answerProblem(l, many)).toMatch(/at most/);
  });

  it('wants a yes or no for a file question', () => {
    expect(answerProblem(q('logo'), { none: true })).toBeNull();
    expect(answerProblem(q('logo'), 'none')).toMatch(/no file/);
  });
});

describe('roundAllows', () => {
  it('saves and submits only while the round is open', () => {
    for (const a of ['save', 'submit'] as const) {
      expect(roundAllows('open', a).ok).toBe(true);
      expect(roundAllows('submitted', a).ok).toBe(false);
      expect(roundAllows('reviewed', a).ok).toBe(false);
    }
  });

  it('reopens a submitted round, but not a reviewed one', () => {
    expect(roundAllows('submitted', 'reopen').ok).toBe(true);
    expect(roundAllows('reviewed', 'reopen')).toEqual({
      ok: false,
      reason: expect.stringMatching(/unlock/),
    });
    expect(roundAllows('open', 'reopen').ok).toBe(false);
  });

  it('unlocks only a reviewed round', () => {
    expect(roundAllows('reviewed', 'unlock').ok).toBe(true);
    expect(roundAllows('submitted', 'unlock').ok).toBe(false);
    expect(roundAllows('open', 'unlock').ok).toBe(false);
  });
});
