import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildCostReport, ESTIMATE_LABEL, formatCostReport, type CostRow } from './cost-report';

const row = (over: Partial<CostRow>): CostRow => ({
  project_id: 'p1',
  stage: 'intake',
  status: 'succeeded',
  attempts: 1,
  tokens_used: 0,
  model: 'gemini:flash',
  started_at: '2026-11-20T10:00:00Z',
  finished_at: '2026-11-20T10:02:00Z',
  ...over,
});

describe('buildCostReport', () => {
  const rows = [
    row({ tokens_used: 300 }),
    row({ stage: 'intake', status: 'failed', attempts: 2, tokens_used: 100 }),
    row({ stage: 'requirements', model: 'stub:template' }),
    row({
      stage: 'build_rounds',
      tokens_used: 5000,
      started_at: '2026-11-20T11:00:00Z',
      finished_at: '2026-11-20T11:10:00Z',
    }),
    row({
      project_id: 'p2',
      stage: 'intake',
      tokens_used: 50,
      status: 'cancelled',
      finished_at: null,
    }),
  ];
  it('totals runs, outcomes, retries, tokens and time per stage, in stage order', () => {
    const r = buildCostReport(rows);
    expect(r.stages.map((s) => s.stage)).toEqual(['intake', 'requirements', 'build_rounds']);
    expect(r.stages[0]).toMatchObject({
      runs: 3,
      succeeded: 1,
      failed: 1,
      other: 1,
      retries: 1,
      tokens: 450,
      avgTokens: 150,
    });
    expect(r.stages[0]!.minutes).toBeCloseTo(4);
    expect(r.stages[2]).toMatchObject({ tokens: 5000, minutes: 10 });
    expect(r.totalRuns).toBe(5);
    expect(r.totalTokens).toBe(5450);
    expect(r.stubRuns).toBe(1);
  });
  it('can be limited to one project and lists projects by tokens', () => {
    expect(buildCostReport(rows, 'p2').totalRuns).toBe(1);
    expect(buildCostReport(rows).projects.map((p) => p.project_id)).toEqual(['p1', 'p2']);
  });
  it('copes with no rows', () => {
    expect(buildCostReport([])).toMatchObject({ stages: [], totalRuns: 0, totalTokens: 0 });
  });
  it('prints a table with the spec estimate and the conversion note', () => {
    const text = formatCostReport(buildCostReport(rows));
    expect(text).toContain('Intake and follow-ups: about $0.30');
    expect(text).toContain('5,000');
    expect(text).toContain('convert by hand');
  });
});

describe('the estimates', () => {
  it('are the spec table rows, word for word', () => {
    const spec = readFileSync(
      join(fileURLToPath(import.meta.url), '../../../../docs/spec/13-cost.md'),
      'utf8',
    );
    for (const label of new Set(Object.values(ESTIMATE_LABEL))) {
      const [name, amount] = label.split(': ');
      expect(spec, label).toContain(`| ${name} | ${amount} |`);
    }
  });
});
