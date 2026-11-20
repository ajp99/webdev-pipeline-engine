// Run with: pnpm --filter @wpe/worker eval:planner   (reads apps/worker/.env for MODEL_PROVIDER; the judge
// uses your Claude Code login, so sign in once with `claude`). Writes the full report to evals/results/ (not
// committed) and the record evals/last-run/planner.json (commit it: a test checks it matches the prompt).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { PlanFixture } from '@wpe/shared';
import { formatReport, runPlannerEval } from './eval-planner';
import { agentJudge, judgeModel } from './judge-agent';
import { modelFromEnv } from './model';
import { plannableSkills } from './planner-supabase';
import { scanSkills } from './skills';

const repo = resolve(import.meta.dirname, '../../..');
const fixturesDir = join(repo, 'evals/fixtures/planner');
const fixtures: PlanFixture[] = readdirSync(fixturesDir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(fixturesDir, f), 'utf8')));
const disk = scanSkills(join(repo, 'skills'));
const skills = plannableSkills(
  disk,
  disk.map((s) => ({ id: s.id, name: s.id, scope: 'library', version: s.version })),
);
const report = await runPlannerEval({
  fixtures,
  skills,
  model: modelFromEnv(process.env),
  judge: agentJudge(),
  judgeModel: judgeModel(),
});
console.log(formatReport(report));
mkdirSync(join(repo, 'evals/results'), { recursive: true });
mkdirSync(join(repo, 'evals/last-run'), { recursive: true });
writeFileSync(
  join(repo, `evals/results/planner-${report.ranAt.replace(/[:.]/g, '-')}.json`),
  JSON.stringify(report, null, 2),
);
writeFileSync(
  join(repo, 'evals/last-run/planner.json'),
  JSON.stringify(
    {
      ranAt: report.ranAt,
      model: report.model,
      judgeModel: report.judgeModel,
      promptHash: report.promptHash,
      pass: report.pass,
      averages: Object.fromEntries(report.results.map((r) => [r.fixture, r.average])),
    },
    null,
    2,
  ) + '\n',
);
process.exit(report.pass ? 0 : 1);
