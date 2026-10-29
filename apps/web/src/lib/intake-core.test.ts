import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  effectiveAnswers,
  validateTemplate,
  type Answers,
  type IntakeTemplate,
  type ReviewRecord,
  type RoundStatus,
  type UploadCounts,
} from '@wpe/shared';
import type { FormFields } from './intake-form';
import {
  addOwnerQuestion,
  canChangeFiles,
  followupsFor,
  removeFollowup,
  reopenRound,
  saveFollowups,
  saveSection,
  startReview,
  submitRound,
  unlockRound,
  type IntakeStore,
  type QuestionRow,
} from './intake-core';

const root = join(fileURLToPath(import.meta.url), '../../../../..');
const check = validateTemplate(
  JSON.parse(readFileSync(join(root, 'templates/intake/generic.v1.json'), 'utf8')),
);
if (!check.ok) throw new Error(check.errors.join('\n'));
const template: IntakeTemplate = check.template;
const opt = (id: string) =>
  (
    template.sections.flatMap((s) => s.questions).find((q) => q.id === id) as {
      options: { value: string }[];
    }
  ).options[0]!.value;

class MemStore implements IntakeStore {
  rounds = new Map<number, RoundStatus>();
  data = new Map<number, Answers>();
  files: UploadCounts = {};
  writes = 0;
  review: ReviewRecord | null = null;
  runActive = false;
  queued = 0;
  queueError: string | null = null;
  constructor(status: RoundStatus | null = 'open') {
    if (status) this.rounds.set(1, status);
  }
  async latestRound() {
    const n = Math.max(0, ...this.rounds.keys());
    return n ? { round: n, status: this.rounds.get(n)! } : null;
  }
  async answers(_p: string, round: number) {
    return this.data.get(round) ?? {};
  }
  async effectiveAnswers() {
    return effectiveAnswers(
      [...this.data].flatMap(([round, a]) =>
        Object.entries(a).map(([question_id, answer]) => ({ round, question_id, answer })),
      ),
    );
  }
  async uploadCounts() {
    return this.files;
  }
  async saveFollowupAnswers(_p: string, round: number, answers: Record<string, string | null>) {
    this.writes++;
    const cur = { ...(this.data.get(round) ?? {}) };
    for (const [id, v] of Object.entries(answers)) {
      if (v === null) delete cur[id];
      else cur[id] = v;
    }
    this.data.set(round, cur);
  }
  questions = new Map<number, QuestionRow[]>();
  async followupRows(_p: string, round: number) {
    return this.questions.get(round) ?? [];
  }
  async addQuestion(_p: string, round: number, text: string) {
    const rows = this.questions.get(round) ?? [];
    const id = `ow${round}_${rows.filter((r) => r.askedBy === 'owner').length + 1}`;
    this.questions.set(round, [...rows, { id, text, askedBy: 'owner' }]);
    this.writes++;
    return id;
  }
  async removeQuestion(_p: string, round: number, id: string) {
    const rows = this.questions.get(round) ?? [];
    if (!rows.some((r) => r.id === id)) return false;
    this.questions.set(
      round,
      rows.filter((r) => r.id !== id),
    );
    const a = { ...(this.data.get(round) ?? {}) };
    delete a[id];
    this.data.set(round, a);
    return true;
  }
  async latestReview() {
    return this.review;
  }
  async reviewRunActive() {
    return this.runActive;
  }
  async lastReviewStatus() {
    return this.runActive ? 'running' : null;
  }
  async enqueueReview() {
    if (this.queueError) throw new Error(this.queueError);
    this.queued++;
  }
  async saveAnswers(_p: string, round: number, answers: Answers) {
    this.writes++;
    this.data.set(round, { ...(this.data.get(round) ?? {}), ...answers });
  }
  async moveRound(_p: string, round: number, from: RoundStatus, to: RoundStatus) {
    if (this.rounds.get(round) !== from) return false;
    this.rounds.set(round, to);
    return true;
  }
}
const f = (values: Record<string, string | string[]>): FormFields => ({
  get: (n) => {
    const v = values[n];
    return v === undefined ? null : Array.isArray(v) ? (v[0] ?? null) : v;
  },
  getAll: (n) => {
    const v = values[n];
    return v === undefined ? [] : Array.isArray(v) ? v : [v];
  },
});
const ALL: Record<string, string | string[]> = {
  q_business_name: 'Acme',
  q_what_you_do: 'Plumbing',
  q_contact_email: 'a@b.co',
  q_site_goal: opt('site_goal'),
  q_main_audience: 'Homeowners',
  q_pages_wanted: [opt('pages_wanted')],
  q_copy_status: opt('copy_status'),
  q_design_style_cards: [opt('design_style_cards')],
  q_layout_density: opt('layout_density'),
  q_logo_none: 'on',
};
async function fillAll(s: MemStore) {
  for (const sec of template.sections) await saveSection(s, template, 'p', sec.id, f(ALL));
}

let store: MemStore;
beforeEach(() => {
  store = new MemStore();
});

describe('saveSection', () => {
  it('saves the answers of one section on an open round', async () => {
    const r = await saveSection(store, template, 'p', 'business', f({ q_business_name: 'Acme' }));
    expect(r.ok).toBe(true);
    expect(store.data.get(1)?.business_name).toBe('Acme');
  });

  it('refuses to write to a submitted or reviewed round', async () => {
    for (const status of ['submitted', 'reviewed'] as const) {
      const s = new MemStore(status);
      const r = await saveSection(s, template, 'p', 'business', f({ q_business_name: 'X' }));
      expect(r.ok).toBe(false);
      expect(s.writes).toBe(0);
    }
  });

  it('saves nothing when one answer in the section is invalid', async () => {
    const r = await saveSection(
      store,
      template,
      'p',
      'design',
      f({
        q_reference_sites_url_0: 'javascript:alert(1)',
        q_layout_density: opt('layout_density'),
      }),
    );
    expect(r.ok).toBe(false);
    expect(store.writes).toBe(0);
  });

  it('refuses an unknown section and a project with no round', async () => {
    expect((await saveSection(store, template, 'p', 'nope', f({}))).ok).toBe(false);
    expect((await saveSection(new MemStore(null), template, 'p', 'business', f({}))).ok).toBe(
      false,
    );
  });
});

describe('submitRound', () => {
  it('is refused while required answers are missing, and names them', async () => {
    const r = await submitRound(store, template, 'p');
    expect(r).toEqual({ ok: false, message: expect.stringContaining('name of the business') });
    expect(store.rounds.get(1)).toBe('open');
  });

  it('is not blocked by a missing logo (a warning only, P2-T15)', async () => {
    await fillAll(store);
    store.data.get(1)!.logo = null;
    const r = await submitRound(store, template, 'p');
    expect(r.ok).toBe(true);
    expect(store.rounds.get(1)).toBe('submitted');
  });

  it('works once every required answer is in, and an uploaded logo counts', async () => {
    await fillAll(store);
    store.data.get(1)!.logo = null;
    store.files = { logo: 1 };
    expect((await submitRound(store, template, 'p')).ok).toBe(true);
    expect(store.rounds.get(1)).toBe('submitted');
  });

  it('cannot submit twice', async () => {
    await fillAll(store);
    await submitRound(store, template, 'p');
    expect((await submitRound(store, template, 'p')).ok).toBe(false);
  });
});

describe('reopen and unlock', () => {
  it('reopens a submitted round so answers can change again', async () => {
    await fillAll(store);
    await submitRound(store, template, 'p');
    expect((await reopenRound(store, 'p')).ok).toBe(true);
    expect(store.rounds.get(1)).toBe('open');
    expect(
      (await saveSection(store, template, 'p', 'business', f({ q_business_name: 'B' }))).ok,
    ).toBe(true);
  });

  it('cannot reopen a reviewed round, but can unlock it', async () => {
    const s = new MemStore('reviewed');
    expect((await reopenRound(s, 'p')).ok).toBe(false);
    expect(s.rounds.get(1)).toBe('reviewed');
    expect((await unlockRound(s, 'p')).ok).toBe(true);
    expect(s.rounds.get(1)).toBe('open');
  });

  it('cannot unlock a round that is not reviewed', async () => {
    for (const status of ['open', 'submitted'] as const) {
      const s = new MemStore(status);
      expect((await unlockRound(s, 'p')).ok).toBe(false);
      expect(s.rounds.get(1)).toBe(status);
    }
  });

  it('reports a round that changed under it instead of overwriting', async () => {
    await fillAll(store);
    const move = store.moveRound.bind(store);
    store.moveRound = async (...a) => {
      store.rounds.set(1, 'reviewed'); // the agent reviewed it meanwhile
      return move(...a);
    };
    const r = await submitRound(store, template, 'p');
    expect(r.ok).toBe(false);
    expect(store.rounds.get(1)).toBe('reviewed');
  });
});

describe('a round that changes under the owner', () => {
  const racing = (initial: RoundStatus, becomes: RoundStatus) => {
    const s = new MemStore(initial);
    const move = s.moveRound.bind(s);
    s.moveRound = async (...a) => {
      s.rounds.set(1, becomes);
      return move(...a);
    };
    return s;
  };

  it('does not reopen a round the agent reviewed meanwhile', async () => {
    const s = racing('submitted', 'reviewed');
    expect((await reopenRound(s, 'p')).ok).toBe(false);
    expect(s.rounds.get(1)).toBe('reviewed');
  });

  it('does not unlock a round that someone reopened meanwhile', async () => {
    const s = racing('reviewed', 'submitted');
    expect((await unlockRound(s, 'p')).ok).toBe(false);
    expect(s.rounds.get(1)).toBe('submitted');
  });
});

describe('canChangeFiles', () => {
  it('is allowed only while the round is open', async () => {
    expect((await canChangeFiles(store, 'p')).ok).toBe(true);
    expect((await canChangeFiles(new MemStore('submitted'), 'p')).ok).toBe(false);
    expect((await canChangeFiles(new MemStore('reviewed'), 'p')).ok).toBe(false);
  });
});

const review = (round: number, ids: string[]): ReviewRecord => ({
  round,
  summary: 's',
  gaps: [],
  followups: ids.map((id) => ({ id, text: `Question ${id}?`, reason: 'r' })),
  model: 'm',
  capped: false,
});

describe('startReview', () => {
  it('queues a review of a submitted round', async () => {
    const s = new MemStore('submitted');
    expect(await startReview(s, 'p')).toMatchObject({ ok: true });
    expect(s.queued).toBe(1);
  });
  it.each(['open', 'reviewed'] as const)('refuses a %s round', async (status) => {
    const s = new MemStore(status);
    expect(await startReview(s, 'p')).toMatchObject({ ok: false });
    expect(s.queued).toBe(0);
  });
  it('refuses while a review is queued or running', async () => {
    const s = new MemStore('submitted');
    s.runActive = true;
    expect(await startReview(s, 'p')).toMatchObject({ ok: false, message: /already/ });
    expect(s.queued).toBe(0);
  });
  it('refuses a project with no round', async () => {
    expect(await startReview(new MemStore(null), 'p')).toMatchObject({ ok: false });
  });
  it('passes on the database refusal instead of throwing', async () => {
    const s = new MemStore('submitted');
    s.queueError = 'enqueue_run: the project already has a queued run';
    expect(await startReview(s, 'p')).toEqual({
      ok: false,
      message: 'enqueue_run: the project already has a queued run',
    });
  });
});

async function round1Answers() {
  const open = new MemStore();
  await fillAll(open);
  return open.data.get(1)!;
}

describe('follow-up rounds', () => {
  function round2() {
    const s = new MemStore('reviewed');
    s.data.set(1, { business_name: 'Acme', what_you_do: 'Plumbing', contact_email: 'a@b.co' });
    s.rounds.set(2, 'open');
    s.review = review(1, ['fu2_1', 'fu2_2']);
    s.questions.set(
      2,
      ['fu2_1', 'fu2_2'].map((id) => ({ id, text: `Question ${id}?`, askedBy: 'agent' as const })),
    );
    return s;
  }

  it('saves the answers to the follow-up questions in the open round, and clears an emptied one', async () => {
    const s = round2();
    const r = await saveFollowups(s, 'p', f({ fu_fu2_1: '  Home and About ', fu_fu2_2: '' }));
    expect(r).toMatchObject({ ok: true });
    expect(s.data.get(2)).toEqual({ fu2_1: 'Home and About' });
    await saveFollowups(s, 'p', f({ fu_fu2_1: '' }));
    expect(s.data.get(2)).toEqual({});
  });
  it('refuses to save into a locked round, or one with no follow-ups', async () => {
    const locked = round2();
    locked.rounds.set(2, 'submitted');
    expect(await saveFollowups(locked, 'p', f({ fu_fu2_1: 'x' }))).toMatchObject({ ok: false });
    const none = round2();
    none.questions.set(2, []);
    expect(await saveFollowups(none, 'p', f({}))).toMatchObject({ ok: false });
    expect(none.writes).toBe(0);
  });
  it('reads the questions from the rows of the round, with the reason from the review', async () => {
    const s = round2();
    const list = await followupsFor(s, 'p', 2);
    expect(list.map((q) => [q.id, q.text, q.reason])).toEqual([
      ['fu2_1', 'Question fu2_1?', 'r'],
      ['fu2_2', 'Question fu2_2?', 'r'],
    ]);
    expect(await followupsFor(s, 'p', 1)).toEqual([]);
  });
  it('refuses an answer over the length limit', async () => {
    const s = round2();
    const r = await saveFollowups(s, 'p', f({ fu_fu2_1: 'x'.repeat(5001) }));
    expect(r).toMatchObject({ ok: false, message: /5000/ });
    expect(s.writes).toBe(0);
  });
  it('lets the round be submitted only when every follow-up is answered', async () => {
    const s = round2();
    s.data.set(1, await round1Answers());
    const first = await submitRound(s, template, 'p');
    expect(first).toMatchObject({ ok: false, message: /follow-up/ });
    await saveFollowups(s, 'p', f({ fu_fu2_1: 'a', fu_fu2_2: 'b' }));
    expect(await submitRound(s, template, 'p')).toMatchObject({ ok: true });
    expect(s.rounds.get(2)).toBe('submitted');
  });
  it('records only what changed when a template answer is edited in a later round', async () => {
    const s = round2();
    s.data.set(1, await round1Answers());
    await saveSection(
      s,
      template,
      'p',
      'business',
      f({ ...ALL, q_business_name: 'Acme Plumbing' }),
    );
    expect(s.data.get(2)).toEqual({ business_name: 'Acme Plumbing' });
    expect((await s.effectiveAnswers()).business_name).toBe('Acme Plumbing');
  });
});

describe('owner questions (P2-T06)', () => {
  function open2() {
    const s = new MemStore('reviewed');
    s.rounds.set(2, 'open');
    s.questions.set(2, [{ id: 'fu2_1', text: 'Which pages?', askedBy: 'agent' }]);
    return s;
  }

  it('adds a trimmed question to the open round', async () => {
    const s = open2();
    expect(await addOwnerQuestion(s, 'p', '  Do you own a domain?  ')).toMatchObject({ ok: true });
    expect(s.questions.get(2)!.at(-1)).toEqual({
      id: 'ow2_1',
      text: 'Do you own a domain?',
      askedBy: 'owner',
    });
  });
  it('refuses an empty question, one over 500 characters, and a locked round', async () => {
    const s = open2();
    expect(await addOwnerQuestion(s, 'p', '   ')).toMatchObject({ ok: false });
    expect(await addOwnerQuestion(s, 'p', 'x'.repeat(501))).toMatchObject({
      ok: false,
      message: /500/,
    });
    s.rounds.set(2, 'submitted');
    expect(await addOwnerQuestion(s, 'p', 'Why?')).toMatchObject({ ok: false });
    expect(s.writes).toBe(0);
  });
  it('has no cap on the number of owner questions', async () => {
    const s = open2();
    for (let i = 0; i < 12; i++) await addOwnerQuestion(s, 'p', `Question ${i}?`);
    expect(s.questions.get(2)).toHaveLength(13);
  });
  it('removes a follow-up with its answer, and refuses an unknown one or a locked round', async () => {
    const s = open2();
    s.data.set(2, { fu2_1: 'Home' });
    expect(await removeFollowup(s, 'p', 'fu2_1')).toMatchObject({ ok: true });
    expect(s.questions.get(2)).toEqual([]);
    expect(s.data.get(2)).toEqual({});
    expect(await removeFollowup(s, 'p', 'fu2_1')).toMatchObject({ ok: false });
    expect(await removeFollowup(s, 'p', 'business_name')).toMatchObject({ ok: false });
    const locked = open2();
    locked.rounds.set(2, 'reviewed');
    expect(await removeFollowup(locked, 'p', 'fu2_1')).toMatchObject({ ok: false });
    expect(locked.questions.get(2)).toHaveLength(1);
  });
  it('lets an open round 1 hold owner questions that must be answered before submit', async () => {
    const s = new MemStore();
    await fillAll(s);
    await addOwnerQuestion(s, 'p', 'Anything else?');
    expect(await submitRound(s, template, 'p')).toMatchObject({ ok: false, message: /follow-up/ });
    await saveFollowups(s, 'p', f({ fu_ow1_1: 'No' }));
    expect(await submitRound(s, template, 'p')).toMatchObject({ ok: true });
  });
});
