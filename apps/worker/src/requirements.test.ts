import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { prdNotesProblem, prdProblem, validateTemplate, type RequirementsInput } from '@wpe/shared';
import { defaultSelector } from './handlers';
import { fakeModel } from './model';
import { requirementsHandler, type RequirementsDeps } from './requirements';
import type { HandlerContext, Run } from './runner';

const root = join(fileURLToPath(import.meta.url), '../../../..');
const template = (() => {
  const c = validateTemplate(
    JSON.parse(readFileSync(join(root, 'templates/intake/generic.v1.json'), 'utf8')),
  );
  if (!c.ok) throw new Error('bad template');
  return c.template;
})();

const run = { id: 'r1', project_id: 'p1', stage: 'requirements', model: null } as unknown as Run;
const ctx = (signal = new AbortController().signal) =>
  ({ run, worker: 'w1', signal, progress: vi.fn(), log: vi.fn() }) as unknown as HandlerContext;

const input = (over: Partial<RequirementsInput> = {}): RequirementsInput => ({
  projectName: 'Acme',
  intake: {
    template,
    answers: { business_name: 'Acme Dental' },
    uploads: {},
    history: [],
    round: 0,
  },
  review: { summary: 'Complete enough.', gaps: [] },
  ownerNotes: ['The client pays late so keep the first build to five pages at most'],
  previous: null,
  ...over,
});

const reply = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    sections: {
      business: 'Acme Dental wants more bookings from new patients.',
      site_map: '- Home\n- Services\n- Contact\n- Privacy policy\n- Cookie notice',
      features: '- Contact form (Must)\n- Blog (Could)',
      content: 'The client supplies photos; the agency drafts the texts.',
      brand: 'Blue and white; friendly tone (proposal, to confirm).',
      non_functional: 'Lighthouse 80+, basic SEO, responsive, accessibility basics.',
    },
    spam_protection: 'honeypot',
    change_summary: '',
    gaps: [{ issue: 'No photos yet', resolution: 'Stock photos proposed' }],
    conflicts: [],
    ...over,
  });

function deps(over: Partial<RequirementsDeps> = {}) {
  const written: Parameters<RequirementsDeps['write']>[0][] = [];
  const d: RequirementsDeps = {
    load: async () => input(),
    write: async (a) => void written.push(a),
    ...over,
  };
  return { d, written };
}

describe('requirementsHandler', () => {
  it('writes a PRD and its owner-only notes that the database accepts, with the model name and tokens', async () => {
    const { d, written } = deps();
    const model = fakeModel(reply(), 250);
    expect(await requirementsHandler(d, model)(ctx())).toEqual({ tokens: 250 });
    expect(written).toHaveLength(1);
    const w = written[0]!;
    expect(w).toMatchObject({ project: 'p1', run: 'r1', worker: 'w1', model: 'fake:model' });
    expect(prdProblem(w.content)).toBeNull();
    expect(prdNotesProblem(w.notes)).toBeNull();
    expect(w.notes.gaps[0]!.issue).toBe('No photos yet');
    // The request carried the intake, the notes as data, and the schema.
    expect(model.requests[0]!.user).toContain('Acme Dental');
    expect(model.requests[0]!.user).toContain('<owner_notes>');
    expect(model.requests[0]!.schema).toHaveProperty('properties.sections');
  });

  it('asks again once when the first answer breaks a rule, and adds up the tokens', async () => {
    const bad = JSON.parse(reply());
    bad.sections.site_map = '- Home';
    const model = fakeModel([JSON.stringify(bad), reply()], 100);
    const { d, written } = deps();
    expect(await requirementsHandler(d, model)(ctx())).toEqual({ tokens: 200 });
    expect(model.requests[1]!.user).toContain('privacy policy');
    expect(written).toHaveLength(1);
  });

  it('fails the run when the PRD quotes the owner notes twice', async () => {
    const leak = reply({
      sections: {
        ...JSON.parse(reply()).sections,
        business: 'The client pays late so keep the first build to five pages at most.',
      },
    });
    const { d, written } = deps();
    await expect(requirementsHandler(d, fakeModel(leak))(ctx())).rejects.toThrow(/confidential/);
    expect(written).toHaveLength(0);
  });

  it('revises the previous version and needs a change summary for it', async () => {
    const previous = JSON.parse(reply());
    delete previous.gaps;
    delete previous.conflicts;
    const { d, written } = deps({ load: async () => input({ previous }) });
    const model = fakeModel([reply(), reply({ change_summary: 'Added a services page.' })]);
    await requirementsHandler(d, model)(ctx());
    expect(model.requests[0]!.user).toContain('<previous_prd>');
    expect(model.requests[1]!.user).toContain('change_summary is empty');
    expect(written[0]!.content.change_summary).toBe('Added a services page.');
  });

  it('does nothing when the stage moved on', async () => {
    const { d, written } = deps({ load: async () => null });
    const model = fakeModel(reply());
    expect(await requirementsHandler(d, model)(ctx())).toEqual({ tokens: 0 });
    expect(model.requests).toHaveLength(0);
    expect(written).toHaveLength(0);
  });

  it('writes nothing when cancelled while the model was thinking', async () => {
    const ac = new AbortController();
    const model = fakeModel(() => {
      ac.abort();
      return reply();
    });
    const { d, written } = deps();
    await expect(requirementsHandler(d, model)(ctx(ac.signal))).rejects.toThrow('stopped');
    expect(written).toHaveLength(0);
  });
});

describe('the requirements stage in the selector', () => {
  it('uses the requirements agent when there is one, and the stub otherwise', () => {
    const requirements = vi.fn();
    const stubs = vi.fn();
    expect(defaultSelector({}, undefined, { requirements, stubs })(run)).toBe(requirements);
    expect(defaultSelector({}, undefined, { stubs })(run)).toBe(stubs);
    const plan = { ...run, stage: 'plan' } as Run;
    expect(defaultSelector({}, undefined, { requirements, stubs })(plan)).toBe(stubs);
  });
});
