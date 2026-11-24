import { describe, expect, it } from 'vitest';
import {
  artifactSections,
  previewUrl,
  prototypeView,
  roundView,
  runBlocked,
  tokenShare,
} from './stage-run';

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
  it('shows a prototype (P3-T04) as its summary, commit, claims and skills', () => {
    const c = {
      page: '/',
      branch: 'staging',
      commit: 'abcdef1234',
      screenshots: { desktop: 'p/prototype/v1-desktop.jpg', mobile: 'p/prototype/v1-mobile.jpg' },
      summary: 'Teal hero.',
      skills: ['starter-customization/apply-brand'],
      claims: 3,
    };
    const out = artifactSections(c)!;
    expect(out[0]).toEqual({ title: 'What the agent did', markdown: 'Teal hero.' });
    expect(out[1]!.markdown).toContain('commit abcdef12');
    expect(out[1]!.markdown).toContain('Claims for the client to confirm: 3');
    expect(prototypeView({ ...c, branch: 'main' })).toBeNull();
  });
  it('shows a plan (P3-T03) as its rounds with hard flags and budgets, then the brief and rationale', () => {
    const plan = {
      rounds: [
        {
          number: 1,
          title: 'Core',
          scope: ['Home'],
          skills: ['seo/x'],
          depends_on: [],
          hard: false,
          token_budget: 200000,
        },
        {
          number: 2,
          title: 'Booking',
          scope: ['Bookings'],
          skills: [],
          depends_on: [1],
          hard: true,
          token_budget: 300000,
        },
      ],
      total_token_budget: 500000,
      design_brief: { palette: 'Teal', fonts: 'Inter', layout: 'Airy', references: 'None' },
      rationale: { rounds: 'r', skills: 's', budget: 'b', design: 'd' },
      model: 'gemini',
    };
    const out = artifactSections(plan)!;
    expect(out[0]!.title).toBe('Rounds (2; 1 hard)');
    expect(out[0]!.markdown).toContain('2. Booking (hard: stronger model)');
    expect(out[0]!.markdown).toContain('Budget: 300,000 tokens');
    expect(out[1]).toEqual({ title: 'Total token budget', markdown: '500,000 tokens' });
    expect(out.map((s) => s.title)).toContain('Design brief: palette');
  });
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

describe('roundView and tokenShare (P4-T06, P4-T10)', () => {
  const ok = {
    round: 2,
    title: 'Services',
    branch: 'round-2',
    commit: 'a'.repeat(40),
    summary: 'Built services',
    files: [{ path: 'app/page.tsx', added: 3, removed: 1 }, { nope: 1 }],
    notes_diff: '+ x',
    screenshots: { desktop: 'p/d.jpg', mobile: 'p/m.jpg' },
    claims: [{ file: 'a.mdx', text: 'Since 2009' }],
    claims_to_check: [],
    unmarked_claims: [{ file: 'b.mdx', text: '20 years' }],
    packages: [{ name: 'clsx', from: null, to: '2.1.1', install_scripts: false }],
    backlog: { questions: 1, assumptions: 2, refused: 0 },
    reader_flags: ['Dropped x'],
    feedback_version: true,
  };
  it('reads a round summary and drops malformed parts', () => {
    const v = roundView(ok)!;
    expect(v.round).toBe(2);
    expect(v.files).toEqual([{ path: 'app/page.tsx', added: 3, removed: 1 }]);
    expect(v.unmarkedClaims).toHaveLength(1);
    expect(v.backlog.assumptions).toBe(2);
    expect(v.feedbackVersion).toBe(true);
  });
  it('is null for anything that is not a round summary', () => {
    expect(roundView({ ...ok, round: '2' })).toBeNull();
    expect(roundView({ ...ok, screenshots: {} })).toBeNull();
    expect(roundView(null)).toBeNull();
  });
  it('shares tokens against the budget, capped at 1', () => {
    expect(tokenShare(50, 200)).toBe(0.25);
    expect(tokenShare(500, 200)).toBe(1);
    expect(tokenShare(5, 0)).toBe(0);
  });
});
