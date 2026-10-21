import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Json } from '@wpe/shared';
import { loadTemplate, type TemplateDeps } from './load-template';

const root = join(fileURLToPath(import.meta.url), '../../../..');
const generic = JSON.parse(readFileSync(join(root, 'templates/intake/generic.v1.json'), 'utf8'));

function fake(existing: { sections: unknown; status: string } | null = null) {
  const inserted: { industry: string; version: number; sections: Json }[] = [];
  const deps: TemplateDeps = {
    find: async () => existing,
    insert: async (industry, version, sections) => {
      inserted.push({ industry, version, sections });
    },
  };
  return { deps, inserted };
}

describe('loadTemplate', () => {
  it('inserts a valid new template', async () => {
    const { deps, inserted } = fake();
    expect(await loadTemplate(deps, generic)).toEqual({
      outcome: 'loaded',
      industry: 'generic',
      version: 1,
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]!.industry).toBe('generic');
  });
  it('does nothing when the same content is already stored', async () => {
    const first = fake();
    await loadTemplate(first.deps, generic);
    const again = fake({ sections: first.inserted[0]!.sections, status: 'approved' });
    expect(await loadTemplate(again.deps, generic)).toMatchObject({ outcome: 'unchanged' });
    expect(again.inserted).toHaveLength(0);
  });
  it('refuses different content under the same version, and inserts nothing', async () => {
    const changed = structuredClone(generic);
    changed.sections[0].questions[0].label = 'A different question';
    const first = fake();
    await loadTemplate(first.deps, generic);
    const again = fake({ sections: first.inserted[0]!.sections, status: 'approved' });
    const r = await loadTemplate(again.deps, changed);
    expect(r).toMatchObject({ outcome: 'refused' });
    expect(again.inserted).toHaveLength(0);
  });
  it('reports validation errors and inserts nothing', async () => {
    const bad = structuredClone(generic);
    delete bad.sections[0].questions[0].required;
    const { deps, inserted } = fake();
    const r = await loadTemplate(deps, bad);
    expect(r.outcome).toBe('invalid');
    if (r.outcome === 'invalid') expect(r.errors[0]).toMatch(/required must be true or false/);
    expect(inserted).toHaveLength(0);
  });
});
