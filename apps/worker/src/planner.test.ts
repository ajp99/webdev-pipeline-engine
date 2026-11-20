import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { checkPlan, type PlanFixture } from '@wpe/shared';
import { fakeModel } from './model';
import { plannerHandler, type PlannerDeps } from './planner';
import { assemblePlannerInput, plannableSkills, type PlannerRows } from './planner-supabase';
import type { HandlerContext, Run } from './runner';

const root = join(fileURLToPath(import.meta.url), '../../../..');
const dental: PlanFixture = JSON.parse(
  readFileSync(join(root, 'evals/fixtures/planner/dental-clinic.json'), 'utf8'),
);
const template = JSON.parse(readFileSync(join(root, 'templates/intake/generic.v1.json'), 'utf8'));
const run = { id: 'r1', project_id: 'p1', stage: 'plan', model: null } as unknown as Run;
const ctx = () =>
  ({
    run,
    worker: 'w1',
    signal: new AbortController().signal,
    progress: vi.fn(),
    log: vi.fn(),
  }) as unknown as HandlerContext;

const skills = [
  'starter-customization/apply-brand',
  'industry-copy/write-page-copy',
  'seo/on-page-basics',
  'accessibility-basics/page-checks',
  'smtp-contact-form/configure-form',
];
const goodReply = JSON.stringify({
  rounds: [
    {
      title: 'Brand and core pages',
      scope: ['Home', 'Services', 'About'],
      skills: skills.slice(0, 4),
      depends_on: [],
      hard: false,
      token_budget: 400_000,
    },
    {
      title: 'Contact and legal',
      scope: ['Contact', 'Privacy policy', 'Cookie notice'],
      skills: [skills[4], skills[3]],
      depends_on: [1],
      hard: false,
      token_budget: 300_000,
    },
  ],
  design_brief: {
    palette: 'Teal and white',
    fonts: 'Inter',
    layout: 'Minimal, airy, mobile first',
    references: 'None given',
  },
  rationale: {
    rounds: '4 pages, no blog: 2 rounds.',
    skills: 'From the PRD.',
    budget: 'Small site.',
    design: 'From the intake.',
  },
});

function deps(over: Partial<PlannerDeps> = {}) {
  const written: Parameters<PlannerDeps['write']>[0][] = [];
  const d: PlannerDeps = {
    load: async () => ({
      projectName: dental.input.projectName,
      prd: dental.input.prd,
      design: dental.input.design,
      references: [],
      skills: skills.map((id) => ({ id, description: id })),
      ownerNotes: [],
      previous: null,
      ownerFeedback: [],
    }),
    write: async (a) => void written.push(a),
    ...over,
  };
  return { d, written };
}

describe('plannerHandler', () => {
  it('writes a plan that passes the fixture checks, with the model and a prompt hash (D-283)', async () => {
    const { d, written } = deps();
    expect(await plannerHandler(d, fakeModel(goodReply, 400))(ctx())).toEqual({ tokens: 400 });
    const w = written[0]!;
    expect(w.model).toBe('fake:model');
    expect(w.promptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(checkPlan(w.plan, dental).filter((c) => !c.pass)).toEqual([]);
    expect(w.plan.total_token_budget).toBe(700_000);
  });
  it('the prompt hash is the same for every project (it hashes the template, not the data)', async () => {
    const a = deps();
    const b = deps({
      load: async () => ({ ...(await deps().d.load('x'))!, projectName: 'Other' }),
    });
    await plannerHandler(a.d, fakeModel(goodReply))(ctx());
    await plannerHandler(b.d, fakeModel(goodReply))(ctx());
    expect(a.written[0]!.promptHash).toBe(b.written[0]!.promptHash);
  });
  it('asks again once when a skill is not in the library', async () => {
    const bad = JSON.parse(goodReply);
    bad.rounds[0].skills.push('deployment/production-release');
    const model = fakeModel([JSON.stringify(bad), goodReply]);
    const { d, written } = deps();
    await plannerHandler(d, model)(ctx());
    expect(model.requests[1]!.user).toContain(
      'skills not in the library: deployment/production-release',
    );
    expect(written).toHaveLength(1);
  });
  it('takes the reference screenshots first, and a failure there does not stop the plan', async () => {
    const capture = vi.fn(async () => Promise.reject(new Error('no browser')));
    const base = deps();
    const { d, written } = deps({
      load: async () => ({
        ...(await base.d.load('p1'))!,
        references: [{ url: 'https://example.org' }],
      }),
      captureReferences: capture,
    });
    const c = ctx();
    await plannerHandler(d, fakeModel(goodReply))(c);
    expect(capture).toHaveBeenCalledWith('p1', ['https://example.org']);
    expect(c.log).toHaveBeenCalledWith('warn', 'reference screenshots skipped: no browser');
    expect(written).toHaveLength(1);
  });
  it('does nothing when the project left the plan stage', async () => {
    const { d, written } = deps({ load: async () => null });
    expect(await plannerHandler(d, fakeModel(goodReply))(ctx())).toEqual({ tokens: 0 });
    expect(written).toHaveLength(0);
  });
});

describe('the Planner loader', () => {
  const library = [
    ...skills.map((name, i) => ({ id: `r${i}`, name, scope: 'library', version: 1 })),
    { id: 'd', name: 'deployment/production-release', scope: 'library', version: 1 },
    { id: 'x', name: 'seo/old', scope: 'deprecated', version: 1 },
  ];
  const diskSkills = [...skills, 'deployment/production-release', 'seo/old'].map((id) => ({
    id,
    description: `about ${id}`,
    version: 1,
    body: '',
  }));
  const plan = {
    ...JSON.parse(goodReply),
    rounds: JSON.parse(goodReply).rounds.map((r: object, i: number) => ({ number: i + 1, ...r })),
    total_token_budget: 700_000,
    model: 'gemini:x',
  };
  const rows = (over: Partial<PlannerRows> = {}): PlannerRows => ({
    project: {
      name: 'Brightside',
      status: 'active',
      stage: 'plan',
      intake_template_snapshot: template,
    },
    responses: [
      { round: 1, question_id: 'layout_density', answer: 'airy' },
      {
        round: 1,
        question_id: 'reference_sites',
        answer: [{ url: 'https://example.org', note: 'clean' }],
      },
      { round: 1, question_id: 'business_name', answer: 'Brightside' },
    ],
    prd: { ...dental.input.prd, model: 'm' },
    newestPlan: { id: 'plan2', content: plan },
    feedback: [
      { artifact_id: 'plan1', body: 'old' },
      { artifact_id: 'plan2', body: 'Merge the rounds' },
    ],
    notes: ['note'],
    skills: diskSkills,
    library,
    ...over,
  });
  it('offers only library build skills (no deployment, handover or deprecated ones)', () => {
    expect(plannableSkills(diskSkills, library).map((s) => s.id)).toEqual(skills);
  });
  it('reads the design answers, the references, the PRD and the previous plan without model names, and only its Feedback', () => {
    const i = assemblePlannerInput(rows())!;
    expect(Object.values(i.design)).toContain('Airy, lots of white space');
    expect(Object.keys(i.design).join(' ')).not.toMatch(/name of the business/i);
    expect(i.references).toEqual([{ url: 'https://example.org', note: 'clean' }]);
    expect(i.prd).not.toHaveProperty('model');
    expect(i.previous).not.toHaveProperty('model');
    expect(i.previous!.rounds).toHaveLength(2);
    expect(i.ownerFeedback).toEqual(['Merge the rounds']);
  });
  it('is null off the plan stage, and fails without an approved PRD', () => {
    expect(
      assemblePlannerInput(
        rows({
          project: {
            name: 'x',
            status: 'active',
            stage: 'prototype',
            intake_template_snapshot: template,
          },
        }),
      ),
    ).toBeNull();
    expect(() => assemblePlannerInput(rows({ prd: null }))).toThrow('no approved PRD');
  });
});
