import { describe, expect, it } from 'vitest';
import type { PrdContent } from '@wpe/shared';
import {
  changeRequestNext,
  defaultSummary,
  lineDiff,
  parseList,
  prdFromForm,
  signedVersion,
  versionList,
} from './prd-view';

const prd = (over: Partial<PrdContent['sections']> = {}): PrdContent => ({
  sections: {
    business: 'B',
    site_map: 'Home\nPrivacy policy\nCookie notice',
    features: 'F',
    content: 'C',
    brand: 'Br',
    non_functional: 'N',
    ...over,
  },
  spam_protection: 'honeypot',
  change_summary: '',
});

describe('lineDiff', () => {
  it('marks kept, removed and added lines in order', () => {
    expect(lineDiff('a\nb\nc', 'a\nx\nc')).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'del', text: 'b' },
      { kind: 'add', text: 'x' },
      { kind: 'same', text: 'c' },
    ]);
  });
  it('handles empty sides and identical text', () => {
    expect(lineDiff('a', 'a')).toEqual([{ kind: 'same', text: 'a' }]);
    expect(lineDiff('a\nb', 'a')).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'del', text: 'b' },
    ]);
  });
  it('shows a very long text as replaced instead of comparing it line by line', () => {
    const big = Array.from({ length: 2001 }, (_, i) => `l${i}`).join('\n');
    const d = lineDiff(big, 'x');
    expect(d.filter((l) => l.kind === 'del')).toHaveLength(2001);
    expect(d.at(-1)).toEqual({ kind: 'add', text: 'x' });
  });
});

describe('versions', () => {
  const rows = [1, 2, 3].map((v) => ({
    id: `a${v}`,
    version: v,
    status: v === 2 ? 'approved' : 'superseded',
    created_at: '',
    created_by: v === 3 ? 'owner-id' : null,
    change_request_id: v === 3 ? 'cr1' : null,
    content: {},
  }));
  it('finds the signed version from the client approvals', () => {
    expect(signedVersion(rows, ['a2'])).toBe(2);
    expect(signedVersion(rows, [])).toBeNull();
  });
  it('labels drafts, the signed v1.0 and later v1.x, newest first, with the author', () => {
    expect(versionList(rows, 2).map((r) => `${r.label} ${r.author}`)).toEqual([
      'v1.1 Owner',
      'v1.0 Agent',
      'Draft 1 Agent',
    ]);
  });
});

describe('defaultSummary', () => {
  it('names the changed sections and the spam protection', () => {
    const after = prd({ brand: 'new' });
    after.spam_protection = 'turnstile';
    expect(defaultSummary(prd(), after)).toBe(
      'Changed: Brand inputs; Contact form spam protection.',
    );
    expect(defaultSummary(prd(), prd())).toBe('');
    expect(defaultSummary(null, prd())).toContain('First version');
  });
});

describe('prdFromForm', () => {
  const form = (over: Record<string, string> = {}) => ({
    section_business: 'B',
    section_site_map: 'Home\r\nPrivacy policy\r\nCookie notice',
    section_features: 'F',
    section_content: 'C',
    section_brand: 'Br',
    section_non_functional: 'N',
    spam_protection: 'honeypot',
    change_summary: ' Changed the brand. ',
    ...over,
  });
  it('builds the PRD with Unix line ends and a trimmed summary', () => {
    const r = prdFromForm(form());
    expect(r.ok && r.content.sections.site_map).toBe('Home\nPrivacy policy\nCookie notice');
    expect(r.ok && r.content.change_summary).toBe('Changed the brand.');
  });
  it('says what is missing', () => {
    expect(prdFromForm(form({ spam_protection: 'x' }))).toEqual({
      ok: false,
      error: 'Choose the contact form spam protection.',
    });
    expect(prdFromForm(form({ change_summary: '\n' }))).toMatchObject({
      ok: false,
      error: expect.stringContaining('summary'),
    });
    expect(prdFromForm(form({ section_site_map: 'Home' }))).toMatchObject({
      ok: false,
      error: expect.stringContaining('privacy policy'),
    });
    expect(prdFromForm(form({ section_brand: ' ' }))).toMatchObject({
      ok: false,
      error: expect.stringContaining('brand'),
    });
  });
});

describe('parseList', () => {
  it('splits on commas and lines, trims and drops blanks and repeats', () => {
    expect(parseList('Home, Gallery\nGallery,, ')).toEqual({
      ok: true,
      items: ['Home', 'Gallery'],
    });
    expect(parseList('')).toEqual({ ok: true, items: [] });
  });
  it('refuses too many or too long items', () => {
    expect(parseList(Array.from({ length: 51 }, (_, i) => `p${i}`).join(',')).ok).toBe(false);
    expect(parseList('x'.repeat(201)).ok).toBe(false);
  });
});

describe('changeRequestNext', () => {
  it('decide, then write the PRD version for an accepted one, then done', () => {
    expect(changeRequestNext({ status: 'received', decision: null, hasPrdVersion: false })).toBe(
      'decide',
    );
    expect(
      changeRequestNext({
        status: 'accepted',
        decision: 'accept_current_round',
        hasPrdVersion: false,
      }),
    ).toBe('write_prd');
    expect(
      changeRequestNext({
        status: 'accepted',
        decision: 'accept_current_round',
        hasPrdVersion: true,
      }),
    ).toBe('done');
    expect(changeRequestNext({ status: 'deferred', decision: 'defer', hasPrdVersion: false })).toBe(
      'done',
    );
  });
});
