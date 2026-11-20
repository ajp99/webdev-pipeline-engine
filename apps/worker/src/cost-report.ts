// The cost report from stage_runs (P2-T22, D-138, D-140): runs and tokens per stage and per project, next to
// the planning estimates in docs/spec/13-cost.md. Token use only: a run stores one token total, not input
// and output apart, and the console shows no dollar amounts, so compare with the estimates by converting by hand.
export type CostRow = {
  project_id: string;
  stage: string;
  status: string;
  attempts: number;
  tokens_used: number;
  model: string | null;
  started_at: string | null;
  finished_at: string | null;
};

/** The spec's estimate for the stages it names (wording as in docs/spec/13-cost.md). */
export const ESTIMATE_LABEL: Record<string, string> = {
  intake: 'Intake and follow-ups: about $0.30',
  requirements: 'Requirements, plan, skill selection: about $0.50',
  plan: 'Requirements, plan, skill selection: about $0.50',
  prototype: 'Single-page prototype: about $2',
  build_rounds: 'Build rounds (about 2-4): about $10-15',
  qc_report: 'QC runs and report: about $2-3',
  handover: 'Docs and handover pack: about $1-2',
};

export type StageCost = {
  stage: string;
  runs: number;
  succeeded: number;
  failed: number;
  other: number;
  retries: number;
  tokens: number;
  avgTokens: number;
  /** Total time from start to finish over the finished runs, in minutes. */
  minutes: number;
};

export type CostReport = {
  stages: StageCost[];
  projects: { project_id: string; runs: number; tokens: number }[];
  totalRuns: number;
  totalTokens: number;
  /** Runs that used a stub or a model that is not a real Claude model (tokens are 0 or not comparable). */
  stubRuns: number;
};

const STAGE_ORDER = [
  'intake',
  'requirements',
  'plan',
  'prototype',
  'build_rounds',
  'qc_report',
  'deploy_prep',
  'handover',
];

export function buildCostReport(rows: CostRow[], projectId?: string): CostReport {
  const use = projectId ? rows.filter((r) => r.project_id === projectId) : rows;
  const by = new Map<string, StageCost>();
  for (const r of use) {
    const s = by.get(r.stage) ?? {
      stage: r.stage,
      runs: 0,
      succeeded: 0,
      failed: 0,
      other: 0,
      retries: 0,
      tokens: 0,
      avgTokens: 0,
      minutes: 0,
    };
    s.runs += 1;
    if (r.status === 'succeeded') s.succeeded += 1;
    else if (r.status === 'failed' || r.status === 'stopped') s.failed += 1;
    else s.other += 1;
    if (r.attempts > 1) s.retries += 1;
    s.tokens += Number(r.tokens_used);
    if (r.started_at && r.finished_at)
      s.minutes += Math.max(0, (Date.parse(r.finished_at) - Date.parse(r.started_at)) / 60_000);
    by.set(r.stage, s);
  }
  const stages = [...by.values()]
    .map((s) => ({ ...s, avgTokens: s.runs ? Math.round(s.tokens / s.runs) : 0 }))
    .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));
  const proj = new Map<string, { project_id: string; runs: number; tokens: number }>();
  for (const r of use) {
    const p = proj.get(r.project_id) ?? { project_id: r.project_id, runs: 0, tokens: 0 };
    p.runs += 1;
    p.tokens += Number(r.tokens_used);
    proj.set(r.project_id, p);
  }
  return {
    stages,
    projects: [...proj.values()].sort((a, b) => b.tokens - a.tokens),
    totalRuns: use.length,
    totalTokens: use.reduce((n, r) => n + Number(r.tokens_used), 0),
    stubRuns: use.filter((r) => r.model === 'stub' || (r.model ?? '').startsWith('stub')).length,
  };
}

const pad = (s: string | number, n: number) => String(s).padEnd(n);
const num = (n: number) => n.toLocaleString('en-US');

export function formatCostReport(r: CostReport): string {
  const lines = [
    `Stage runs: ${r.totalRuns}, tokens: ${num(r.totalTokens)}${r.stubRuns ? ` (${r.stubRuns} stub runs)` : ''}`,
    '',
    `${pad('stage', 14)}${pad('runs', 6)}${pad('ok', 5)}${pad('failed', 8)}${pad('retried', 9)}${pad('tokens', 12)}${pad('avg', 10)}${pad('min', 7)}estimate (spec 13-cost.md)`,
  ];
  for (const s of r.stages)
    lines.push(
      `${pad(s.stage, 14)}${pad(s.runs, 6)}${pad(s.succeeded, 5)}${pad(s.failed, 8)}${pad(s.retries, 9)}${pad(num(s.tokens), 12)}${pad(num(s.avgTokens), 10)}${pad(s.minutes.toFixed(1), 7)}${ESTIMATE_LABEL[s.stage] ?? ''}`,
    );
  lines.push('', 'Per project:');
  for (const p of r.projects)
    lines.push(`  ${p.project_id}  ${p.runs} runs  ${num(p.tokens)} tokens`);
  lines.push(
    '',
    'Tokens are one total per run (input and output are not stored). The spec estimates are in dollars:',
    'convert by hand with the model prices in docs/spec/13-cost.md (D-138, D-140).',
  );
  return lines.join('\n');
}
