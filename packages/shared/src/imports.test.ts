import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// A cycle between source files can pass under vitest and still crash in the Next bundler
// ("Cannot access 'STAGES' before initialization", found in P1-T09). Find cycles statically.
const SRC = process.env.WPE_SHARED_SRC ?? dirname(fileURLToPath(import.meta.url));

function files(): string[] {
  return readdirSync(SRC)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'database.types.ts')
    .map((f) => join(SRC, f));
}

function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const out: string[] = [];
  for (const m of text.matchAll(/^(?:import|export)\s[^;]*?from\s+'(\.[^']*)'/gms)) {
    const target = resolve(dirname(file), m[1]!);
    out.push(target.endsWith('.ts') ? target : `${target}.ts`);
  }
  return out;
}

function findCycle(): string[] | null {
  const graph = new Map(files().map((f) => [f, importsOf(f)]));
  const state = new Map<string, 'open' | 'done'>();
  const path: string[] = [];
  const visit = (f: string): string[] | null => {
    if (state.get(f) === 'done') return null;
    if (state.get(f) === 'open') return [...path.slice(path.indexOf(f)), f];
    state.set(f, 'open');
    path.push(f);
    for (const next of graph.get(f) ?? []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    path.pop();
    state.set(f, 'done');
    return null;
  };
  for (const f of graph.keys()) {
    const cycle = visit(f);
    if (cycle) return cycle;
  }
  return null;
}

describe('packages/shared imports', () => {
  it('has no import cycle between source files', () => {
    const cycle = findCycle();
    expect(cycle?.map((f) => f.split('/').pop()).join(' -> ') ?? null).toBeNull();
  });
});
