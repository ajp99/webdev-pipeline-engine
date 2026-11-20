// The skills library on disk and in the registry (P3-T01, D-105 to D-107, D-282). The worker scans `skills/`
// at start and before each run and brings skills_registry in step; a run loads only the skills the approved
// plan selected, and only ones the registry lists as library skills.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSkill, SKILL_ID, type Skill } from '@wpe/shared';
import type { Handler, HandlerSelector } from './runner';

/** Reads and checks every skills/<area>/<name>/SKILL.md; a bad file stops the scan with its problem. */
export function scanSkills(root: string): Skill[] {
  const out: Skill[] = [];
  if (!existsSync(root)) return out;
  for (const area of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const name of readdirSync(join(root, area.name), { withFileTypes: true }).filter((d) =>
      d.isDirectory(),
    )) {
      const file = join(root, area.name, name.name, 'SKILL.md');
      if (!existsSync(file)) continue;
      const r = parseSkill(`${area.name}/${name.name}`, readFileSync(file, 'utf8'));
      if (!r.ok) throw new Error(r.error);
      out.push(r.skill);
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export type RegistryRow = { id: string; name: string; scope: string; version: number };

export interface RegistryDeps {
  listLibrary(): Promise<RegistryRow[]>;
  insert(row: { name: string; path: string; version: number }): Promise<void>;
  setVersion(id: string, version: number): Promise<void>;
  deprecate(id: string): Promise<void>;
}

/**
 * Brings the registry in step with the files: a new skill is added as a library skill, a changed version is
 * updated, and a library skill whose file is gone is marked deprecated (its history stays). Returns what changed.
 */
export async function syncRegistry(deps: RegistryDeps, skills: Skill[]): Promise<string[]> {
  const rows = await deps.listLibrary();
  const byName = new Map(rows.map((r) => [r.name, r]));
  const changes: string[] = [];
  for (const s of skills) {
    const row = byName.get(s.id);
    if (!row) {
      await deps.insert({ name: s.id, path: `skills/${s.id}/SKILL.md`, version: s.version });
      changes.push(`added ${s.id} v${s.version}`);
    } else if (row.version !== s.version) {
      await deps.setVersion(row.id, s.version);
      changes.push(`${s.id} v${row.version} -> v${s.version}`);
    }
  }
  const onDisk = new Set(skills.map((s) => s.id));
  for (const r of rows)
    if (!onDisk.has(r.name)) {
      await deps.deprecate(r.id);
      changes.push(`deprecated ${r.name}`);
    }
  return changes;
}

/**
 * The skills a run may load: exactly the ids the plan selected, each present on disk and listed in the
 * registry as a library skill. Anything else is refused with its id, so a plan cannot pull in an unknown file.
 */
export function loadSelected(selected: string[], skills: Skill[], library: RegistryRow[]): Skill[] {
  const listed = new Set(library.filter((r) => r.scope === 'library').map((r) => r.name));
  const byId = new Map(skills.map((s) => [s.id, s]));
  const out: Skill[] = [];
  for (const id of [...new Set(selected)]) {
    if (!SKILL_ID.test(id)) throw new Error(`skill id "${id}" is not area/name`);
    const s = byId.get(id);
    if (!s || !listed.has(id)) throw new Error(`skill ${id} is not in the library`);
    out.push(s);
  }
  return out;
}

/** Wraps a handler selector so every run first brings the registry in step with `skills/` (P3-T01). */
export function withSkillSync(
  select: HandlerSelector,
  sync: () => Promise<unknown>,
): HandlerSelector {
  return (run) => {
    const h = select(run);
    if (!h) return undefined;
    const wrapped: Handler = async (ctx) => {
      await sync();
      return h(ctx);
    };
    return wrapped;
  };
}
