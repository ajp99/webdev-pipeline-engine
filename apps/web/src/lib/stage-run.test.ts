import { describe, expect, it } from 'vitest';
import { artifactSections, previewUrl, runBlocked } from './stage-run';

describe('runBlocked', () => {
  it('offers Run on a skeleton stage of an active project with no open run', () => {
    for (const stage of ['requirements', 'plan', 'prototype', 'build_rounds'])
      expect(runBlocked({ stage, status: 'active', hasOpenRun: false })).toBeNull();
  });
  it('refuses a paused or closed project', () => {
    expect(runBlocked({ stage: 'plan', status: 'paused', hasOpenRun: false })).toMatch(/paused/);
    expect(runBlocked({ stage: 'plan', status: 'closed', hasOpenRun: false })).toMatch(/closed/);
  });
  it('refuses a stage with no runner (intake has its own Run review)', () => {
    expect(runBlocked({ stage: 'intake', status: 'active', hasOpenRun: false })).toMatch(
      /no runner/,
    );
    expect(runBlocked({ stage: 'qc_report', status: 'active', hasOpenRun: false })).toMatch(
      /qc report/,
    );
  });
  it('refuses while a run is queued or running', () => {
    expect(runBlocked({ stage: 'plan', status: 'active', hasOpenRun: true })).toMatch(/already/);
  });
});

describe('runBlocked: a stage whose newest artifact is approved', () => {
  it('asks to advance instead of running again', () => {
    expect(
      runBlocked({ stage: 'plan', status: 'active', hasOpenRun: false, newestApproved: true }),
    ).toMatch(/already approved; advance/);
  });
  it('does not matter for the build stage, which has no stub artifact', () => {
    expect(
      runBlocked({
        stage: 'build_rounds',
        status: 'active',
        hasOpenRun: false,
        newestApproved: false,
      }),
    ).toBeNull();
  });
});

describe('previewUrl', () => {
  it('takes the newest preview line', () => {
    expect(previewUrl(['Preview: http://localhost:4101', 'Preview: http://localhost:4100'])).toBe(
      'http://localhost:4101',
    );
  });
  it('accepts a trailing slash', () => {
    expect(previewUrl(['Preview: http://localhost:4100/'])).toBe('http://localhost:4100/');
  });
  it('ignores anything that is not exactly a localhost preview line', () => {
    expect(
      previewUrl(['Preview: https://evil.example', 'see Preview: http://localhost:4100']),
    ).toBeNull();
    expect(previewUrl(['Preview: http://localhost:4100@evil.example'])).toBeNull();
    expect(previewUrl(['Preview: http://localhost:4100/x'])).toBeNull();
    expect(previewUrl(['Preview: javascript:alert(1)'])).toBeNull();
    expect(previewUrl([])).toBeNull();
  });
});

describe('artifactSections', () => {
  it('shows a PRD (D-325) as its fixed sections, the change summary first, and the notes as gaps and conflicts', () => {
    const prd = {
      sections: {
        business: 'B',
        site_map: 'Home; Privacy policy; Cookie notice',
        features: 'F',
        content: 'C',
        brand: 'Br',
        non_functional: 'N',
      },
      spam_protection: 'honeypot',
      change_summary: 'Added a blog',
      model: 'stub',
    };
    const out = artifactSections(prd)!;
    expect(out[0]).toEqual({ title: 'What changed', markdown: 'Added a blog' });
    expect(out.map((s) => s.title)).toContain('Site map and pages');
    expect(out.at(-1)).toEqual({ title: 'Contact form spam protection', markdown: 'honeypot' });
    expect(
      artifactSections({ gaps: [{ issue: 'No budget', resolution: 'Asked' }], conflicts: [] }),
    ).toEqual([
      { title: 'Gaps (owner only)', markdown: '- No budget (Asked)' },
      { title: 'Conflicts (owner only)', markdown: 'None.' },
    ]);
  });
  it('reads a sections list', () => {
    expect(artifactSections({ sections: [{ title: 'A', markdown: 'x' }] })).toEqual([
      { title: 'A', markdown: 'x' },
    ]);
  });
  it('returns null for anything else', () => {
    expect(artifactSections(null)).toBeNull();
    expect(artifactSections({})).toBeNull();
    expect(artifactSections({ sections: [] })).toBeNull();
    expect(artifactSections({ sections: [{ title: 'A' }] })).toBeNull();
    expect(artifactSections({ sections: ['x'] })).toBeNull();
  });
});
