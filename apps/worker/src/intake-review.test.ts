import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { validateTemplate, type Completion, type ReviewInput } from '@wpe/shared';
import { defaultSelector } from './handlers';
import {
  assembleReviewInput,
  intakeReviewHandler,
  unconfiguredReviewHandler,
  type ReviewDeps,
} from './intake-review';
import { fakeModel } from './model';
import type { Run } from './runner';

const root = join(fileURLToPath(import.meta.url), '../../../..');
const snapshot = JSON.parse(readFileSync(join(root, 'templates/intake/generic.v1.json'), 'utf8'));
const template = (() => {
  const c = validateTemplate(snapshot);
  if (!c.ok) throw new Error('bad template');
  return c.template;
})();

const run = { id: 'r1', project_id: 'p1', stage: 'intake', model: null } as unknown as Run;
const input = (round = 1): ReviewInput => ({
  template,
  answers: { business_name: 'Acme' },
  uploads: {},
  history: [],
  round,
});
const reply = (followups: number, over: object = {}) =>
  JSON.stringify({
    summary: 'Needs goals.',
    gaps: [{ issue: 'Goal is vague', question_id: 'site_goal' }],
    followups: Array.from({ length: followups }, (_, i) => ({
      text: `Q${i + 1}?`,
      reason: 'unclear',
    })),
    ...over,
  });

function deps(i: ReviewInput | null = input()) {
  const completed: { project: string; round: number; c: Completion; model: string }[] = [];
  const d: ReviewDeps = {
    load: vi.fn(async () => i),
    complete: vi.fn(
      async (project, round, c, model) => void completed.push({ project, round, c, model }),
    ),
  };
  return { d, completed };
}
const ctx = (signal = new AbortController().signal) => ({ run, signal, progress: vi.fn() });

describe('intakeReviewHandler', () => {
  it('asks the model, then completes the review with numbered follow-ups, and reports the tokens', async () => {
    const { d, completed } = deps();
    const m = fakeModel(reply(2), 321);
    const out = await intakeReviewHandler(d, m)(ctx());
    expect(out).toEqual({ tokens: 321 });
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({ project: 'p1', round: 1, model: 'fake:model' });
    expect(completed[0]!.c.followups.map((f) => f.id)).toEqual(['fu2_1', 'fu2_2']);
    expect(completed[0]!.c.summary).toBe('Needs goals.');
  });

  it('sends the client answers as data, with the schema', async () => {
    const { d } = deps();
    const m = fakeModel(reply(0));
    await intakeReviewHandler(d, m)(ctx());
    expect(m.requests[0]!.user).toContain('<client_data>');
    expect(m.requests[0]!.user).toContain('Acme');
    expect(m.requests[0]!.schema).toMatchObject({ required: ['summary', 'gaps', 'followups'] });
  });

  it('does nothing when there is no submitted round any more', async () => {
    const { d, completed } = deps(null);
    const m = fakeModel(reply(1));
    expect(await intakeReviewHandler(d, m)(ctx())).toEqual({ tokens: 0 });
    expect(m.requests).toHaveLength(0);
    expect(completed).toHaveLength(0);
  });

  it('asks once more when the reply has too many follow-ups', async () => {
    const { d, completed } = deps();
    const m = fakeModel([reply(9), reply(3)], 10);
    const out = await intakeReviewHandler(d, m)(ctx());
    expect(out).toEqual({ tokens: 20 });
    expect(m.requests[1]!.user).toContain('rejected');
    expect(completed[0]!.c.followups).toHaveLength(3);
  });

  it('fails, writing nothing, when the model is wrong twice', async () => {
    const { d, completed } = deps();
    const m = fakeModel(['nonsense', '{"summary": ""}']);
    await expect(intakeReviewHandler(d, m)(ctx())).rejects.toThrow(/rejected twice/);
    expect(completed).toHaveLength(0);
  });

  it('writes nothing when the run was cancelled while the model was thinking', async () => {
    const { d, completed } = deps();
    const ac = new AbortController();
    const m = fakeModel(() => {
      ac.abort();
      return reply(1);
    });
    await expect(intakeReviewHandler(d, m)(ctx(ac.signal))).rejects.toThrow(/stopped/);
    expect(completed).toHaveLength(0);
  });

  it('keeps the cap: follow-ups asked in the last round become gaps', async () => {
    const { d, completed } = deps(input(4));
    const m = fakeModel(reply(2));
    await intakeReviewHandler(d, m)(ctx());
    expect(completed[0]!.c.followups).toEqual([]);
    expect(completed[0]!.c.gaps.length).toBe(3);
    expect(m.requests[0]!.system).toMatch(/NO follow-up/);
  });

  it('shows signs of life while it works', async () => {
    const { d } = deps();
    const c = ctx();
    await intakeReviewHandler(d, fakeModel(reply(1)))(c);
    expect(c.progress).toHaveBeenCalled();
  });

  it('fails when the database refuses the review', async () => {
    const { d } = deps();
    d.complete = vi.fn(async () => {
      throw new Error('complete_intake_review: only a submitted round can be reviewed');
    });
    await expect(intakeReviewHandler(d, fakeModel(reply(1)))(ctx())).rejects.toThrow(
      /submitted round/,
    );
  });
});

describe('unconfiguredReviewHandler', () => {
  it('fails the run with the reason', async () => {
    await expect(unconfiguredReviewHandler('MODEL_PROVIDER is not set')(ctx())).rejects.toThrow(
      'MODEL_PROVIDER is not set',
    );
  });
});

describe('assembleReviewInput', () => {
  const rows = (over = {}) => ({
    snapshot,
    round: 2,
    responses: [
      { round: 1, question_id: 'business_name', answer: 'Acme' },
      { round: 2, question_id: 'business_name', answer: 'Acme Plumbing' },
      { round: 2, question_id: 'fu2_1', answer: 'Home, About, Contact', question: 'Which pages?' },
      { round: 2, question_id: 'fu2_2', answer: null, question: 'Which colours?' },
    ],
    uploadKinds: ['logo', 'logo', 'brand_guideline'],
    ...over,
  });

  it('merges answers newest-first, counts uploads per question and carries follow-ups with answers', () => {
    const i = assembleReviewInput(rows());
    expect(i.round).toBe(2);
    expect(i.answers.business_name).toBe('Acme Plumbing');
    expect(i.uploads).toEqual({ logo: 2, brand_guideline: 1 });
    expect(i.history).toEqual([
      { id: 'fu2_1', text: 'Which pages?', answer: 'Home, About, Contact' },
      { id: 'fu2_2', text: 'Which colours?', answer: null },
    ]);
  });

  it('includes a question the owner added and leaves out a removed one (its row is gone)', () => {
    const i = assembleReviewInput(
      rows({
        responses: [
          { round: 2, question_id: 'ow2_1', answer: 'Yes', question: 'Do you have a domain?' },
          { round: 2, question_id: 'fu2_10', answer: null, question: 'Tenth' },
          { round: 2, question_id: 'fu2_2', answer: null, question: 'Second' },
        ],
      }),
    );
    expect(i.history.map((h) => h.id)).toEqual(['fu2_2', 'fu2_10', 'ow2_1']);
  });

  it('ignores template rows (no question text)', () => {
    const i = assembleReviewInput(
      rows({
        responses: [{ round: 1, question_id: 'business_name', answer: 'Acme', question: null }],
      }),
    );
    expect(i.history).toEqual([]);
  });

  it('carries the notes (capped) and the Feedback, and leaves both out when empty', () => {
    expect(assembleReviewInput(rows())).not.toHaveProperty('ownerNotes');
    expect(assembleReviewInput(rows())).not.toHaveProperty('feedback');
    const i = assembleReviewInput(
      rows({
        notes: ['x'.repeat(3000), 'y'.repeat(3000), '  '],
        feedback: ['ask about the domain', ' '],
      }),
    );
    expect(i.ownerNotes?.join('').length).toBe(4000);
    expect(i.feedback).toEqual(['ask about the domain']);
  });

  it('refuses a template that is not valid', () => {
    expect(() => assembleReviewInput(rows({ snapshot: { sections: [] } }))).toThrow(/not valid/);
  });
});

describe('defaultSelector', () => {
  const sel = (review?: Parameters<typeof defaultSelector>[1]) => defaultSelector({}, review);
  const r = (over: object) => ({ ...run, ...over }) as Run;

  it('keeps the stub run, sends intake runs to the review and leaves other stages without a handler', () => {
    const review = async () => undefined;
    expect(sel(review)(r({ model: 'stub' }))).toBeTypeOf('function');
    expect(sel(review)(r({ model: 'stub' }))).not.toBe(review);
    expect(sel(review)(r({}))).toBe(review);
    expect(sel(review)(r({ stage: 'plan' }))).toBeUndefined();
  });

  it('runs a stub in the intake stage as a stub, not as a review', () => {
    const review = async () => undefined;
    expect(sel(review)(r({ model: 'stub', stage: 'intake' }))).not.toBe(review);
  });
});
