import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { validateTemplate, type ReviewInput } from '@wpe/shared';
import type { HandlerContext, Run } from './runner';
import {
  buildStubPlan,
  buildStubPrd,
  buildStubPrototype,
  stubStageHandler,
  type StubDeps,
} from './stage-stubs';

const root = join(fileURLToPath(import.meta.url), '../../../..');
const snapshot = JSON.parse(readFileSync(join(root, 'templates/intake/generic.v1.json'), 'utf8'));
const template = (() => {
  const c = validateTemplate(snapshot);
  if (!c.ok) throw new Error('bad template');
  return c.template;
})();
const input = (
  answers: ReviewInput['answers'] = { business_name: 'Acme Dental' },
): ReviewInput => ({
  template,
  answers,
  uploads: {},
  history: [],
  round: 1,
});

describe('buildStubPrd', () => {
  it('names the project and lists the answered questions only', () => {
    const prd = buildStubPrd('Acme', input());
    const text = JSON.stringify(prd);
    expect(prd.stub).toBe(true);
    expect(prd.sections[0]!.markdown).toContain('Acme');
    expect(text).toContain('Acme Dental');
    // Every section after the overview holds at least one answered question.
    expect(prd.sections.slice(1).every((s) => s.markdown.startsWith('- '))).toBe(true);
  });
  it('is deterministic: the same intake gives the same PRD', () => {
    expect(buildStubPrd('Acme', input())).toEqual(buildStubPrd('Acme', input()));
  });
  it('cuts a very long answer', () => {
    const prd = buildStubPrd('Acme', input({ business_name: 'x'.repeat(5000) }));
    const line = prd.sections
      .flatMap((s) => s.markdown.split('\n'))
      .find((l) => l.includes('xxx'))!;
    expect(line.length).toBeLessThan(2200);
    expect(line.endsWith('…')).toBe(true);
  });
  it('includes answered follow-ups', () => {
    const i = input();
    i.history = [{ id: 'fu2_1', text: 'Which pages?', answer: 'Home only' }];
    expect(JSON.stringify(buildStubPrd('Acme', i))).toContain('Home only');
  });
});

describe('buildStubPlan and buildStubPrototype', () => {
  const prd = buildStubPrd('Acme', input());
  it('plans one page from the PRD sections', () => {
    const plan = buildStubPlan(prd);
    expect(plan.sections[0]!.title).toMatch(/^Pages/);
    expect(plan.sections[0]!.markdown).toContain('Overview (stub)');
  });
  it('refuses a PRD with no sections', () => {
    expect(() => buildStubPlan({})).toThrow(/no sections/);
    expect(() => buildStubPlan(null)).toThrow(/no sections/);
  });
  it('restates the plan in the prototype note', () => {
    expect(buildStubPrototype(buildStubPlan(prd)).sections[0]!.markdown).toContain('"/" (Home)');
  });
  it('refuses a plan without a pages section', () => {
    expect(() => buildStubPrototype({ sections: [{ title: 'x', markdown: 'y' }] })).toThrow(
      /pages/,
    );
  });
});

describe('stubStageHandler', () => {
  const run = (stage: string) => ({ id: 'r1', project_id: 'p1', stage }) as unknown as Run;
  const ctx = (stage: string, signal = new AbortController().signal) =>
    ({ run: run(stage), worker: 'w1', log: vi.fn(), signal, progress: vi.fn() }) as HandlerContext;
  const deps = (over: Partial<StubDeps> = {}) => {
    const written: Parameters<StubDeps['write']>[0][] = [];
    const prd = buildStubPrd('Acme', input());
    const d: StubDeps = {
      loadIntake: async () => ({ projectName: 'Acme', input: input() }),
      loadApproved: async (_p, type) => (type === 'prd' ? prd : buildStubPlan(prd)),
      write: async (a) => void written.push(a),
      ...over,
    };
    return { d, written };
  };

  it('writes a prd for the requirements stage, with the run and worker', async () => {
    const { d, written } = deps();
    expect(await stubStageHandler(d)(ctx('requirements'))).toEqual({ tokens: 0 });
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ project: 'p1', run: 'r1', worker: 'w1', type: 'prd' });
  });
  it('writes a plan and a prototype in their stages', async () => {
    const a = deps();
    await stubStageHandler(a.d)(ctx('plan'));
    expect(a.written[0]!.type).toBe('plan');
    const b = deps();
    await stubStageHandler(b.d)(ctx('prototype'));
    expect(b.written[0]!.type).toBe('prototype');
  });
  it('fails with a reason when the thing it builds from is missing', async () => {
    await expect(
      stubStageHandler(deps({ loadIntake: async () => null }).d)(ctx('requirements')),
    ).rejects.toThrow(/no intake/);
    await expect(
      stubStageHandler(deps({ loadApproved: async () => null }).d)(ctx('plan')),
    ).rejects.toThrow(/no approved PRD/);
    await expect(
      stubStageHandler(deps({ loadApproved: async () => null }).d)(ctx('prototype')),
    ).rejects.toThrow(/no approved plan/);
  });
  it('refuses a stage it has no stub for', async () => {
    await expect(stubStageHandler(deps().d)(ctx('qc_report'))).rejects.toThrow(/no stub/);
  });
  it('writes nothing when the run was cancelled meanwhile', async () => {
    const ac = new AbortController();
    ac.abort();
    const { d, written } = deps();
    await expect(stubStageHandler(d)(ctx('requirements', ac.signal))).rejects.toThrow('stopped');
    expect(written).toHaveLength(0);
  });
});
