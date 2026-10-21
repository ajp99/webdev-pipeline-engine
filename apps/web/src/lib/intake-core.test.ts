import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  validateTemplate,
  type Answers,
  type IntakeTemplate,
  type RoundStatus,
  type UploadCounts,
} from '@wpe/shared';
import type { FormFields } from './intake-form';
import {
  canChangeFiles,
  reopenRound,
  saveSection,
  submitRound,
  unlockRound,
  type IntakeStore,
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
  async uploadCounts() {
    return this.files;
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

  it('is refused when only the logo is missing', async () => {
    await fillAll(store);
    store.data.get(1)!.logo = null;
    const r = await submitRound(store, template, 'p');
    expect(r.ok).toBe(false);
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
