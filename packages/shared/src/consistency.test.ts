import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { STAGES } from './index';
import { Constants } from './database.types';

// P1-T04: the SQL and the TypeScript constants must agree with docs/spec/stages.yaml and gates.yaml.
const root = join(fileURLToPath(import.meta.url), '../../../..');
const stagesYaml = parse(readFileSync(join(root, 'docs/spec/stages.yaml'), 'utf8'));
const gatesYaml = parse(readFileSync(join(root, 'docs/spec/gates.yaml'), 'utf8'));
const migrationsDir = join(root, 'supabase/migrations');
const sql = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), 'utf8'))
  .join('\n');

function enumValues(name: string): string[] {
  const m = sql.match(new RegExp(`create type ${name} as enum \\(([^)]*)\\)`, 'i'));
  if (!m) throw new Error(`enum ${name} not found in migrations`);
  return [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!);
}

function gateConfigSeed(): string[] {
  const m = sql.match(/insert into gate_config \(stage, gate_type, gatekeeper\) values([^;]*);/i);
  if (!m) throw new Error('gate_config seed not found in migrations');
  return [...m[1]!.matchAll(/\(\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'\s*\)/g)].map(
    (x) => `${x[1]}/${x[2]}/${x[3]}`,
  );
}

describe('stages.yaml and gates.yaml agree with SQL and TypeScript', () => {
  const yamlStages: string[] = [...stagesYaml.stages]
    .sort((a, b) => a.order - b.order)
    .map((s: { id: string }) => s.id);

  it('the SQL stage enum lists the yaml stages in order', () => {
    expect(enumValues('stage')).toEqual(yamlStages);
  });

  it('the TypeScript STAGES constant lists the yaml stages in order', () => {
    expect([...STAGES]).toEqual(yamlStages);
  });

  it('the gate_config seed rows equal the yaml gates', () => {
    const expected = gatesYaml.gates.flatMap(
      (g: { stage: string; approvals: { gate_type: string; gatekeeper: string }[] }) =>
        g.approvals.map((a) => `${g.stage}/${a.gate_type}/${a.gatekeeper}`),
    );
    expect(gateConfigSeed()).toEqual(expected);
  });

  it('every gate stage is a known stage and the closed stage has no gate', () => {
    const gated = gatesYaml.gates.map((g: { stage: string }) => g.stage);
    for (const s of gated) expect(yamlStages).toContain(s);
    expect(gated).not.toContain('closed');
  });

  it('the SQL status and close-reason enums match the yaml', () => {
    expect(enumValues('project_status')).toEqual(stagesYaml.project_status);
    expect(enumValues('close_reason')).toEqual(stagesYaml.close_reason);
  });

  it('the release-note approval is not a stage gate (D-223)', () => {
    expect(gatesYaml.releases[0].artifact_type).toBe('release_note');
    expect(gatesYaml.gates.some((g: { stage: string }) => g.stage === 'release_note')).toBe(false);
  });
});

describe('generated database types (P1-T03)', () => {
  const generated = readFileSync(join(root, 'packages/shared/src/database.types.ts'), 'utf8');

  it('declare every table the migrations create', () => {
    const created = [...sql.matchAll(/create table (\w+) \(/gi)].map((m) => m[1]!).sort();
    const typed = [...generated.matchAll(/^\s{6}(\w+): \{\n\s+Row:/gm)].map((m) => m[1]!).sort();
    expect(created.length).toBe(23);
    expect(typed).toEqual(created);
  });

  it('list the same stages as stages.yaml', () => {
    expect([...Constants.public.Enums.stage]).toEqual([...STAGES]);
  });
});
