// The 2a flow through the real run executor (executeRun) and the real handlers, with the model and the Builder's
// agent faked; claiming and queue order are not exercised here (supabase/tests/runner_suite.sql does that) (P2-T22, D-304): intake review, then the stub requirements, plan and prototype stages, then the
// build. A small in-memory "database" plays the parts the SQL functions play (artifacts, approvals); the
// "owner" approves each artifact between runs. The SQL side of the same flow is supabase/tests/flow_suite.sql.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateTemplate, type Completion, type ReviewInput } from '@wpe/shared';
import { builderHandler, type BuilderDeps } from './builder';
import { defaultSelector } from './handlers';
import { intakeReviewHandler, type ReviewDeps } from './intake-review';
import { fakeModel } from './model';
import {
  executeRun,
  type FinalStatus,
  type LogLevel,
  type Run,
  type RunnerConfig,
  type RunnerDeps,
} from './runner';
import { stubStageHandler, type StubDeps } from './stage-stubs';

const root = join(fileURLToPath(import.meta.url), '../../../..');
const snapshot = JSON.parse(readFileSync(join(root, 'templates/intake/generic.v1.json'), 'utf8'));
const template = (() => {
  const c = validateTemplate(snapshot);
  if (!c.ok) throw new Error('bad template');
  return c.template;
})();
const intake: ReviewInput = {
  template,
  answers: { business_name: 'Acme Dental' },
  uploads: {},
  history: [],
  round: 1,
};

type Art = { type: string; status: 'draft' | 'approved'; content: unknown };

function world() {
  const artifacts: Art[] = [];
  const logs: [LogLevel, string][] = [];
  const finished: { stage: string; status: FinalStatus; tokens: number }[] = [];
  const written: string[] = [];
  const approved = (type: string) =>
    [...artifacts].reverse().find((a) => a.type === type && a.status === 'approved')?.content ??
    null;

  const review: ReviewDeps = {
    load: async () => intake,
    complete: async (_p, round, c: Completion, model) => {
      artifacts.push({ type: 'intake_record', status: 'draft', content: { round, ...c, model } });
    },
  };
  const stubs: StubDeps = {
    loadIntake: async () => ({ projectName: 'Acme', input: intake }),
    loadApproved: async (_p, type) => approved(type),
    write: async (a) => {
      artifacts.push({ type: a.type, status: 'draft', content: a.content });
    },
  };
  const calls: string[] = [];
  const builder: BuilderDeps = {
    loadApproved: async (_p, type) => approved(type),
    prepare: async () => (calls.push('prepare'), '/work/acme'),
    stopPreview: async () => void calls.push('stopPreview'),
    build: async ({ prompt }) => {
      calls.push('build');
      written.push(prompt);
      return { sessionId: 'sess-1', tokens: 1000 };
    },
    check: async () => void calls.push('check'),
    startPreview: async () => (calls.push('startPreview'), 'http://localhost:4100'),
    resumeTrial: async () => ({ ok: true, note: 'it named app/page.tsx', tokens: 20 }),
  };
  const deps: RunnerDeps = {
    claim: async () => null,
    heartbeat: async () => 'running',
    finish: async (id, _w, status, tokens) => {
      finished.push({ stage: id, status, tokens });
      return status;
    },
    log: async (_run, level, message) => void logs.push([level, message]),
  };
  const approve = (type: string) => {
    for (const a of artifacts) if (a.type === type) a.status = 'approved';
  };
  const selector = defaultSelector(
    {},
    intakeReviewHandler(
      review,
      fakeModel(JSON.stringify({ summary: 'Complete.', gaps: [], followups: [] }), 300),
    ),
    { stubs: stubStageHandler(stubs), builder: builderHandler(builder) },
  );
  return { artifacts, logs, finished, written, calls, deps, approve, selector };
}

const cfg: RunnerConfig = {
  worker: 'w1',
  heartbeatMs: 1000,
  watchdogMs: 20 * 60_000,
  graceMs: 500,
  log: () => {},
};
const runFor = (stage: string): Run =>
  ({
    id: stage,
    project_id: 'p1',
    stage,
    status: 'running',
    attempts: 1,
    trace_id: 't',
    model: null,
  }) as unknown as Run;

// The database refuses stage content that is not a non-empty object, sets "model", or is over 100000
// characters (complete_stage_artifact). Whatever the stub handlers write has to pass those rules.
function dbAccepts(content: unknown): boolean {
  return (
    typeof content === 'object' &&
    content !== null &&
    !Array.isArray(content) &&
    Object.keys(content).length > 0 &&
    !('model' in content) &&
    JSON.stringify(content).length <= 100_000
  );
}

describe('the 2a flow, stubbed', () => {
  it('runs from intake review to a built page with a preview, each stage on the one before', async () => {
    const w = world();
    const run = (stage: string) => executeRun(w.deps, runFor(stage), w.selector, cfg);

    expect(await run('intake')).toBe('succeeded');
    expect(w.artifacts.map((a) => a.type)).toEqual(['intake_record']);
    w.approve('intake_record');

    expect(await run('requirements')).toBe('succeeded');
    const prd = JSON.stringify(w.artifacts.find((a) => a.type === 'prd')!.content);
    expect(prd).toContain('Acme Dental');
    w.approve('prd');

    expect(await run('plan')).toBe('succeeded');
    expect(JSON.stringify(w.artifacts.find((a) => a.type === 'plan')!.content)).toContain(
      'Overview (stub)',
    );
    w.approve('plan');

    expect(await run('prototype')).toBe('succeeded');
    expect(JSON.stringify(w.artifacts.find((a) => a.type === 'prototype')!.content)).toContain(
      'Planned',
    );
    w.approve('prototype');

    expect(await run('build_rounds')).toBe('succeeded');
    expect(w.calls).toEqual(['prepare', 'stopPreview', 'build', 'check', 'startPreview']);
    // The Builder was given the approved PRD and plan.
    expect(w.written[0]).toContain('Acme Dental');
    expect(w.logs).toContainEqual(['info', 'Preview: http://localhost:4100']);
    expect(
      w.logs.some(([l, m]) => l === 'info' && m.startsWith('Session resume trial: worked')),
    ).toBe(true);

    expect(w.finished.map((f) => f.status)).toEqual(Array(5).fill('succeeded'));
    // Tokens reported per run: the review's, none for the stubs, the build's plus the trial's.
    expect(w.finished.map((f) => f.tokens)).toEqual([300, 0, 0, 0, 1020]);
    expect(w.logs.filter(([l]) => l === 'error')).toEqual([]);
    // What the stubs wrote is something complete_stage_artifact accepts.
    for (const type of ['prd', 'plan', 'prototype'])
      expect(dbAccepts(w.artifacts.find((a) => a.type === type)!.content), type).toBe(true);
  });

  it('the content rules above reject what the database rejects', () => {
    for (const bad of [null, [], {}, { model: 'x', a: 1 }, { a: 'x'.repeat(100_001) }, 'text'])
      expect(dbAccepts(bad)).toBe(false);
  });

  it('fails a stage with the reason in the log when the thing it builds from is not approved', async () => {
    const w = world();
    await executeRun(w.deps, runFor('intake'), w.selector, cfg);
    // The PRD is drafted but the client never signed it off, so planning must not start from it.
    await executeRun(w.deps, runFor('requirements'), w.selector, cfg);
    expect(await executeRun(w.deps, runFor('plan'), w.selector, cfg)).toBe('failed');
    expect(w.logs).toContainEqual(['error', 'there is no approved PRD to plan from']);
    expect(w.artifacts.filter((a) => a.type === 'plan')).toHaveLength(0);
  });

  it('fails the build with the reason in the log when the plan is not approved, and touches nothing', async () => {
    const w = world();
    expect(await executeRun(w.deps, runFor('build_rounds'), w.selector, cfg)).toBe('failed');
    expect(w.logs).toContainEqual(['error', 'there is no approved PRD to build from']);
    expect(w.calls).toEqual([]);
  });

  it('a stage with no handler fails with the reason instead of hanging', async () => {
    const w = world();
    expect(await executeRun(w.deps, runFor('qc_report'), w.selector, cfg)).toBe('failed');
    expect(w.logs).toContainEqual(['error', 'no handler for stage qc_report']);
  });
});
