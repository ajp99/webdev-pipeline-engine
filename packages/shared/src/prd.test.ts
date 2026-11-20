import { describe, expect, it } from 'vitest';
import {
  changedSections,
  prdMarkdown,
  prdNotesProblem,
  prdProblem,
  prdVersionLabel,
  type PrdContent,
} from './prd';

// The same cases as supabase/tests/prd_suite.sql, so the TypeScript check and the database agree.
const valid = (): PrdContent => ({
  sections: {
    business: 'b',
    site_map: 'Home; Privacy policy; Cookie notice',
    features: 'Contact form',
    content: 'c',
    brand: 'b',
    non_functional: 'Lighthouse 80+',
  },
  spam_protection: 'honeypot',
  change_summary: '',
});
const withSection = (k: string, v: unknown) => ({
  ...valid(),
  sections: { ...valid().sections, [k]: v },
});

describe('prdProblem', () => {
  it('accepts a valid PRD, with or without a stored model', () => {
    expect(prdProblem(valid())).toBeNull();
    expect(prdProblem({ ...valid(), model: 'stub' })).toBeNull();
  });
  it.each([
    ['not an object', [], 'must be an object'],
    [
      'a missing section',
      (() => {
        const p = valid() as { sections: Record<string, string> };
        delete p.sections.brand;
        return p;
      })(),
      'section brand is missing',
    ],
    ['an empty section', withSection('content', '  '), 'section content is missing'],
    ['a section that is not text', withSection('content', ['x']), 'section content is missing'],
    ['an unknown section', withSection('pricing', 'x'), 'not one of'],
    ['an unknown key', { ...valid(), round_plan: 'x' }, 'key other than'],
    ['a long section', withSection('brand', 'x'.repeat(20_001)), 'over 20000'],
    [
      'no privacy policy',
      withSection('site_map', 'Home; Cookie notice'),
      'privacy policy and a cookie notice',
    ],
    [
      'no cookie notice',
      withSection('site_map', 'Home; Privacy policy'),
      'privacy policy and a cookie notice',
    ],
    [
      'an unknown spam protection',
      { ...valid(), spam_protection: 'captcha' },
      'spam_protection must be',
    ],
    [
      'no change summary',
      (() => {
        const p: Partial<PrdContent> = valid();
        delete p.change_summary;
        return p;
      })(),
      'change_summary must be',
    ],
    [
      'a long change summary',
      { ...valid(), change_summary: 'x'.repeat(1001) },
      'change_summary must be',
    ],
  ])('refuses %s', (_name, c, msg) => {
    expect(prdProblem(c)).toContain(msg);
  });
  it('accepts each spam protection choice', () => {
    for (const s of ['honeypot', 'turnstile', 'no_contact_form'] as const)
      expect(prdProblem({ ...valid(), spam_protection: s })).toBeNull();
  });
});

describe('prdNotesProblem', () => {
  it('accepts gaps and conflicts with optional resolutions', () => {
    expect(
      prdNotesProblem({
        gaps: [{ issue: 'no budget' }],
        conflicts: [{ issue: 'x', resolution: 'y' }],
      }),
    ).toBeNull();
  });
  it.each([
    ['null', null, 'must be an object'],
    ['no conflicts list', { gaps: [] }, 'need a conflicts list'],
    ['another key', { gaps: [], conflicts: [], owner_notes: 'x' }, 'other than gaps and conflicts'],
    ['an item without an issue', { gaps: [{ resolution: 'x' }], conflicts: [] }, 'needs an issue'],
    [
      'an item with another key',
      { gaps: [{ issue: 'x', quote: 'y' }], conflicts: [] },
      'needs an issue',
    ],
    [
      'a resolution that is not text',
      { gaps: [], conflicts: [{ issue: 'x', resolution: 1 }] },
      'needs an issue',
    ],
    [
      '51 gaps',
      { gaps: Array.from({ length: 51 }, (_, i) => ({ issue: `g${i}` })), conflicts: [] },
      'more than 50 gaps',
    ],
  ])('refuses %s', (_name, c, msg) => {
    expect(prdNotesProblem(c)).toContain(msg);
  });
});

describe('PRD helpers', () => {
  it('renders every section and the spam protection as markdown', () => {
    const md = prdMarkdown(valid());
    expect(md).toContain('## Site map and pages\n\nHome; Privacy policy; Cookie notice');
    expect(md).toContain('## Contact form spam protection\n\nhoneypot field');
  });
  it('lists the changed sections in the fixed order', () => {
    const b = withSection('brand', 'new') as PrdContent;
    b.sections.business = 'new';
    expect(changedSections(valid(), b)).toEqual(['business', 'brand']);
    expect(changedSections(valid(), valid())).toEqual([]);
  });
  it('labels drafts before the sign-off and v1.x from it (D-326)', () => {
    expect(prdVersionLabel(2, null)).toBe('Draft 2');
    expect(prdVersionLabel(1, 3)).toBe('Draft 1');
    expect(prdVersionLabel(3, 3)).toBe('v1.0');
    expect(prdVersionLabel(5, 3)).toBe('v1.2');
  });
});
