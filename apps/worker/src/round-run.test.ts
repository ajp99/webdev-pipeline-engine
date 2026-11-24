import type { Plan, PlanRound, ReaderFields } from '@wpe/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  claimsToCheck,
  nextRound,
  parseBacklog,
  roundHandler,
  type RoundDeps,
  type RoundLoad,
  type RoundRow,
} from './round-run';
import type { HandlerContext } from './runner';

const rnd = (number: number, depends_on: number[] = [], hard = false): PlanRound => ({
  number,
  title: `Round ${number}`,
  scope: [`Page ${number}`],
  skills: ['build/sections'],
  depends_on,
  hard,
  token_budget: 200_000,
});
const plan: Plan = {
  rounds: [rnd(1), rnd(2, [1]), rnd(3, [1])],
  total_token_budget: 600_000,
  design_brief: { palette: 'blue', fonts: 'Inter', layout: 'single column', references: 'none' },
  rationale: { rounds: 'r', skills: 's', budget: 'b', design: 'd' },
};
const row = (number: number, status: RoundRow['status'], merged = false): RoundRow => ({
  number,
  status,
  merged,
});

describe('nextRound (P4-T01)', () => {
  it.each<[string, RoundRow[], RoundLoad['feedback'], number | null, string | null]>([
    ['starts with round 1', [], null, 1, 'next'],
    ['waits while a round is in review', [row(1, 'in_review')], null, null, null],
    [
      'builds a Feedback version of the round in review',
      [row(1, 'in_review')],
      { round: 1, notes: ['x'] },
      1,
      'feedback',
    ],
    ['retries a round left building', [row(1, 'approved'), row(2, 'building')], null, 2, 'retry'],
    ['takes the next round once its dependency is approved', [row(1, 'approved')], null, 2, 'next'],
    [
      'round 1 has no dependency, so it starts even when its row exists',
      [row(1, 'planned')],
      null,
      1,
      'next',
    ],
    [
      'stops when every round is approved',
      [row(1, 'approved'), row(2, 'approved'), row(3, 'approved')],
      null,
      null,
      null,
    ],
    [
      'ignores Feedback on a round that is not in review',
      [row(1, 'approved')],
      { round: 1, notes: ['x'] },
      2,
      'next',
    ],
  ])('%s', (_l, rows, fb, n, why) => {
    const r = nextRound(plan, rows, fb);
    expect(r?.round.number ?? null).toBe(n);
    expect(r?.why ?? null).toBe(why);
  });
  it('a round whose dependency is not approved blocks the rounds after it', () => {
    const p: Plan = { ...plan, rounds: [rnd(1), rnd(2, [3]), rnd(3)] };
    expect(nextRound(p, [row(1, 'approved')], null)).toBeNull();
  });
});

describe('parseBacklog (P4-T04)', () => {
  it('keeps known kinds with a question, and says what it dropped', () => {
    const r = parseBacklog(
      JSON.stringify([
        {
          kind: 'question',
          question: 'Which phone number?',
          options: 'a, b',
          assumption: 'used a',
        },
        { kind: 'blocker', question: 'No logo' },
        { kind: 'wish', question: 'x' },
        { kind: 'question', question: '  ' },
      ]),
    );
    expect(r.entries.map((e) => e.kind)).toEqual(['question', 'blocker']);
    expect(r.problem).toContain('2 backlog entries were dropped');
  });
  it('an empty or missing file is no backlog; broken JSON is a problem, not a crash', () => {
    expect(parseBacklog('')).toEqual({ entries: [], problem: null });
    expect(parseBacklog('{oops').problem).toContain('not valid JSON');
    expect(parseBacklog('{"a":1}').problem).toContain('not a list');
  });
});

const fields: ReaderFields = {
  business: { name: 'Brightside', tagline: '', summary: '', audience: '', tone: '' },
  services: [],
  contact: { phone: '', email: '', address: '', hours: '' },
  people: [],
  testimonials: [],
  claims: [],
  answers: [],
  assets: [],
  references: [],
  flags: ['Dropped business.summary: text that reads like an instruction'],
};

function deps(over: Partial<RoundLoad> = {}, backlog = '') {
  const order: string[] = [];
  const written: Parameters<RoundDeps['write']>[0][] = [];
  const prompts: string[] = [];
  const load: RoundLoad = {
    projectName: 'Brightside',
    plan,
    rounds: [],
    feedback: null,
    ownerAnswers: [],
    open: [],
    reader: {
      projectName: 'Brightside',
      intake: {},
      clientAnswers: [],
      uploads: [],
      references: [],
    },
    skills: [{ id: 'build/sections', description: 'd', version: 1, body: 'SKILL BODY' }],
    allowedPackages: [],
    ...over,
  };
  const step = (name: string) => async () => void order.push(name);
  const d: RoundDeps = {
    load: async () => load,
    read: async () => (order.push('read'), { fields, tokens: 10 }),
    prepare: async () => (order.push('prepare'), '/w/site'),
    stopPreview: step('stopPreview'),
    merge: async (_d, n, _io, reviewed) => (
      order.push(`merge ${n}${reviewed ? ` at ${reviewed}` : ''}`),
      'f'.repeat(40)
    ),
    onBranch: step('onBranch'),
    recordMerge: async (_p, n) => void order.push(`recordMerge ${n}`),
    branch: async (_d, b, _io, fresh) => void order.push(`branch ${b}${fresh ? ' fresh' : ''}`),
    startRound: async (_p, r) => void order.push(`startRound ${r.number}`),
    session: async (a) => {
      order.push(`session ${a.model}`);
      prompts.push(a.prompt);
      return { summary: 'Built it', tokens: 500, model: a.model };
    },
    refused: step('refused'),
    askOwner: () => async () => 'approved',
    checks: step('checks'),
    takeBacklog: async () => (order.push('takeBacklog'), backlog),
    logBacklog: async (a) => void order.push(`logBacklog ${a.entries.length}`),
    claims: async () => (
      order.push('claims'),
      {
        marked: [
          { file: 'content/pages/home.mdx', text: 'Since 2009' },
          { file: 'content/pages/home.mdx', text: '500 happy patients' },
        ],
        unmarked: [{ file: 'content/pages/about.mdx', text: 'Award-winning team' }],
      }
    ),
    commit: async (_d, _io, m) => (order.push(`commit ${m}`), 'a'.repeat(40)),
    diff: async () => (
      order.push('diff'),
      {
        files: [{ path: 'app/page.tsx', added: 10, removed: 2 }],
        notes: '+ round 1',
        packages: [{ name: 'clsx', from: null, to: '2.1.1', install_scripts: false }],
      }
    ),
    startPreview: async () => (order.push('startPreview'), 'http://localhost:4100'),
    screenshots: async () => (
      order.push('screenshots'),
      { desktop: Buffer.from('d'), mobile: Buffer.from('m') }
    ),
    store: async () => (order.push('store'), { desktop: 'p/d.png', mobile: 'p/m.png' }),
    write: async (a) => void (order.push('write'), written.push(a)),
  };
  return { d, order, written, prompts };
}
const ctx = () =>
  ({
    run: { id: 'run-1', project_id: 'p1' },
    worker: 'w1',
    signal: new AbortController().signal,
    progress: vi.fn(),
    log: vi.fn(),
  }) as unknown as HandlerContext;

describe('roundHandler (P4-T01, P4-T04)', () => {
  it('runs round 1 in order and writes the summary for review', async () => {
    const { d, order, written, prompts } = deps();
    expect(await roundHandler(d)(ctx())).toEqual({ tokens: 510 });
    expect(order).toEqual([
      'prepare',
      'stopPreview',
      'branch round-1',
      'startRound 1',
      'read',
      'session claude-sonnet-5-5',
      'onBranch',
      'takeBacklog',
      'checks',
      'claims',
      'commit Round 1: Round 1',
      'diff',
      'startPreview',
      'screenshots',
      'store',
      'write',
    ]);
    expect(written[0]!.content).toMatchObject({
      round: 1,
      branch: 'round-1',
      base: 'staging',
      claims: [
        { file: 'content/pages/home.mdx', text: 'Since 2009' },
        { file: 'content/pages/home.mdx', text: '500 happy patients' },
      ],
      claims_to_check: [
        { file: 'content/pages/home.mdx', text: 'Since 2009' },
        { file: 'content/pages/home.mdx', text: '500 happy patients' },
      ],
      unmarked_claims: [{ file: 'content/pages/about.mdx', text: 'Award-winning team' }],
      packages: [{ name: 'clsx', from: null, to: '2.1.1', install_scripts: false }],
      reader_flags: fields.flags,
      feedback_version: false,
    });
    expect(prompts[0]).toContain('SKILL BODY');
    expect(prompts[0]).not.toContain('Dropped business.summary');
  });
  it('merges accepted rounds into staging first, then takes the next round', async () => {
    const { d, order } = deps({ rounds: [row(1, 'approved')] });
    await roundHandler(d)(ctx());
    expect(order.slice(2, 6)).toEqual([
      'merge 1',
      'recordMerge 1',
      'branch round-2',
      'startRound 2',
    ]);
  });
  it('gives the owner Feedback to the Builder for a new version', async () => {
    const { d, written, prompts } = deps({
      rounds: [row(1, 'in_review')],
      feedback: { round: 1, notes: ['Bigger logo'] },
    });
    await roundHandler(d)(ctx());
    expect(prompts[0]).toContain('Bigger logo');
    expect(written[0]!.content.feedback_version).toBe(true);
  });
  it('a hard round runs on Opus 5.5 (D-333)', async () => {
    const { d, order } = deps({
      plan: { ...plan, rounds: [rnd(1, [], true)], total_token_budget: 200_000 },
    });
    await roundHandler(d)(ctx());
    expect(order).toContain('session claude-opus-5-5');
  });
  it('a blocker logs the backlog, keeps the work and stops before review', async () => {
    const { d, order, written } = deps(
      {},
      JSON.stringify([{ kind: 'blocker', question: 'No logo yet' }]),
    );
    await roundHandler(d)(ctx());
    expect(order.slice(-3)).toEqual([
      'takeBacklog',
      'logBacklog 1',
      'commit Round 1: work so far (blocked)',
    ]);
    expect(written).toEqual([]);
    expect(order).not.toContain('checks');
  });
  it('does nothing while a round is in review, apart from merging accepted ones', async () => {
    const { d, order } = deps({ rounds: [row(1, 'approved', true), row(2, 'in_review')] });
    expect(await roundHandler(d)(ctx())).toEqual({ tokens: 0 });
    expect(order).toEqual(['prepare', 'stopPreview']);
  });
  it('a failed check fails the run before anything is committed', async () => {
    const { d, order } = deps();
    d.checks = async () => {
      throw new Error('pnpm build failed');
    };
    await expect(roundHandler(d)(ctx())).rejects.toThrow('pnpm build failed');
    expect(order.some((s) => s.startsWith('commit'))).toBe(false);
  });
});

describe('triage, Reject and the claim check (P4-T01, P4-T05, P4-T09)', () => {
  it("the next round waits until the earlier rounds' questions and blockers are triaged", () => {
    expect(
      nextRound(plan, [row(1, 'approved')], null, [{ round: 1, kind: 'question' }]),
    ).toBeNull();
    expect(
      nextRound(plan, [row(1, 'approved')], null, [{ round: null, kind: 'question' }])?.round
        .number,
    ).toBe(2);
  });
  it('a blocked round waits for its blocker, then is retried', () => {
    expect(nextRound(plan, [row(1, 'building')], null, [{ round: 1, kind: 'blocker' }])).toBeNull();
    expect(nextRound(plan, [row(1, 'building')], null, [{ round: 1, kind: 'question' }])?.why).toBe(
      'retry',
    );
  });
  it('a rejected round starts again from staging', async () => {
    const { d, order } = deps({
      rounds: [{ number: 1, status: 'planned', merged: false, branch: null }],
    });
    await roundHandler(d)(ctx());
    expect(order).toContain('branch round-1 fresh');
  });
  it('lists marked claims whose numbers the client never gave', () => {
    const f = { ...fields, claims: ['Family practice since 2009'] };
    expect(
      claimsToCheck(
        [
          { file: 'a', text: 'Since 2009' },
          { file: 'a', text: '500 happy patients' },
          { file: 'a', text: 'Friendly team' },
        ],
        f,
      ).map((c) => c.text),
    ).toEqual(['500 happy patients']);
  });
});

describe('gate review fixes (P4)', () => {
  it("keeps the owner's Feedback when a Feedback run failed and the round is retried", () => {
    expect(nextRound(plan, [row(1, 'building')], { round: 1, notes: ['x'] })?.why).toBe('feedback');
  });
  it('merges an accepted round at the commit the owner reviewed', async () => {
    const { d, order } = deps({
      rounds: [{ number: 1, status: 'approved', merged: false, reviewed: 'abc' }],
    });
    await roundHandler(d)(ctx());
    expect(order).toContain('merge 1 at abc');
  });
  it('stops before committing when the Builder left the round branch', async () => {
    const { d, order } = deps();
    d.onBranch = async () => {
      throw new Error('the Builder ended on staging, not round-1');
    };
    await expect(roundHandler(d)(ctx())).rejects.toThrow('ended on staging');
    expect(order.some((s) => s.startsWith('commit'))).toBe(false);
  });
});
