import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { parseSkill } from '@wpe/shared';
import type { HandlerContext, Run } from './runner';
import { loadSelected, scanSkills, syncRegistry, withSkillSync, type RegistryRow } from './skills';

const repoSkills = join(fileURLToPath(import.meta.url), '../../../../skills');
const md = (
  id: string,
  version = 1,
  body = '## Preconditions\n\nx\n\n## Steps\n\n1. y\n\n## Decision guidance\n\n- z',
) => `---\nname: ${id}\ndescription: Does a thing.\nversion: ${version}\n---\n\n# T\n\n${body}\n`;

describe('the skills library in skills/', () => {
  const skills = scanSkills(repoSkills);
  it('has a valid first skill in every area of skills/README.md', () => {
    const areas = new Set(skills.map((s) => s.id.split('/')[0]));
    for (const a of [
      'starter-customization',
      'industry-copy',
      'seo',
      'accessibility-basics',
      'mdx-content-structure',
      'smtp-contact-form',
      'deployment',
      'handover',
    ])
      expect(areas.has(a), a).toBe(true);
  });
  it('names no client, URL or colour of a real project (skills use parameters)', () => {
    for (const s of skills)
      expect(s.body, s.id).not.toMatch(/https?:\/\/(?!localhost)|#[0-9a-f]{6}\b/i);
  });
});

describe('parseSkill', () => {
  it('reads the front matter and body', () => {
    const r = parseSkill('seo/x', md('seo/x', 3));
    expect(r.ok && r.skill.version).toBe(3);
  });
  it.each([
    ['a name that is not the folder', 'seo/x', md('seo/y'), 'name must be seo/x'],
    ['no front matter', 'seo/x', '# T', 'front-matter'],
    ['a bad version', 'seo/x', md('seo/x').replace('version: 1', 'version: one'), 'version'],
    ['a missing section', 'seo/x', md('seo/x', 1, '## Steps\n\n1.'), 'Preconditions'],
    ['a bad folder', 'SEO/x', md('SEO/x'), 'lower case'],
  ])('refuses %s', (_n, id, text, msg) => {
    const r = parseSkill(id, text);
    expect(!r.ok && r.error).toContain(msg);
  });
});

describe('scanSkills, syncRegistry and loadSelected', () => {
  const root = mkdtempSync(join(tmpdir(), 'skills-'));
  for (const [id, v] of [
    ['seo/basics', 2],
    ['seo/extra', 1],
  ] as const) {
    mkdirSync(join(root, id), { recursive: true });
    writeFileSync(join(root, id, 'SKILL.md'), md(id, v));
  }
  const skills = scanSkills(root);

  it('adds new skills, updates a changed version and deprecates a removed one', async () => {
    const rows: RegistryRow[] = [
      { id: 'r1', name: 'seo/basics', scope: 'library', version: 1 },
      { id: 'r2', name: 'seo/gone', scope: 'library', version: 1 },
    ];
    const deps = {
      listLibrary: async () => rows,
      insert: vi.fn(async () => {}),
      setVersion: vi.fn(async () => {}),
      deprecate: vi.fn(async () => {}),
    };
    expect(await syncRegistry(deps, skills)).toEqual([
      'seo/basics v1 -> v2',
      'added seo/extra v1',
      'deprecated seo/gone',
    ]);
    expect(deps.insert).toHaveBeenCalledWith({
      name: 'seo/extra',
      path: 'skills/seo/extra/SKILL.md',
      version: 1,
    });
    expect(deps.setVersion).toHaveBeenCalledWith('r1', 2);
    expect(deps.deprecate).toHaveBeenCalledWith('r2');
  });
  it('changes nothing when the registry is in step', async () => {
    const rows = skills.map((s, i) => ({
      id: `r${i}`,
      name: s.id,
      scope: 'library',
      version: s.version,
    }));
    const deps = {
      listLibrary: async () => rows,
      insert: vi.fn(),
      setVersion: vi.fn(),
      deprecate: vi.fn(),
    };
    expect(await syncRegistry(deps, skills)).toEqual([]);
  });
  it('loads only the selected library skills and refuses anything else', () => {
    const lib = [
      { id: 'a', name: 'seo/basics', scope: 'library', version: 2 },
      { id: 'b', name: 'seo/extra', scope: 'deprecated', version: 1 },
    ];
    expect(loadSelected(['seo/basics', 'seo/basics'], skills, lib).map((s) => s.id)).toEqual([
      'seo/basics',
    ]);
    expect(() => loadSelected(['seo/extra'], skills, lib)).toThrow('not in the library');
    expect(() => loadSelected(['seo/unknown'], skills, lib)).toThrow('not in the library');
    expect(() => loadSelected(['../etc/passwd'], skills, lib)).toThrow('not area/name');
  });
  it('a bad SKILL.md stops the scan with its problem', () => {
    const bad = mkdtempSync(join(tmpdir(), 'skills-bad-'));
    mkdirSync(join(bad, 'seo', 'x'), { recursive: true });
    writeFileSync(join(bad, 'seo', 'x', 'SKILL.md'), md('seo/y'));
    expect(() => scanSkills(bad)).toThrow('name must be seo/x');
  });
});

describe('withSkillSync', () => {
  it('syncs before every run, and a failed sync fails the run', async () => {
    const order: string[] = [];
    const h = vi.fn(async () => (order.push('run'), { tokens: 0 }));
    const sync = vi.fn(async () => order.push('sync'));
    const sel = withSkillSync(() => h, sync);
    await sel({} as Run)!({} as HandlerContext);
    expect(order).toEqual(['sync', 'run']);
    const failing = withSkillSync(
      () => h,
      async () => Promise.reject(new Error('bad skill')),
    );
    await expect(failing({} as Run)!({} as HandlerContext)).rejects.toThrow('bad skill');
    expect(withSkillSync(() => undefined, sync)({} as Run)).toBeUndefined();
  });
});
