// SKILL.md files (P3-T01, D-105 to D-107, D-282): the format, parsed and checked. The library lives in
// `skills/<area>/<name>/SKILL.md`; a skill's id is "<area>/<name>".

export type Skill = { id: string; description: string; version: number; body: string };

export const SKILL_SECTIONS = ['## Preconditions', '## Steps', '## Decision guidance'] as const;
export const SKILL_ID = /^[a-z0-9-]+\/[a-z0-9-]+$/;

/** Parses a SKILL.md at `skills/<id>/SKILL.md`; the front matter's name must equal the folder's id. */
export function parseSkill(
  id: string,
  text: string,
): { ok: true; skill: Skill } | { ok: false; error: string } {
  const where = `skills/${id}/SKILL.md`;
  if (!SKILL_ID.test(id))
    return { ok: false, error: `${where}: the folder must be skills/<area>/<name> in lower case` };
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text.replace(/\r\n/g, '\n'));
  if (!m)
    return { ok: false, error: `${where}: starts with a front-matter block between --- lines` };
  const fields = Object.fromEntries(
    m[1]!.split('\n').map((l) => {
      const i = l.indexOf(':');
      return i < 0 ? [l.trim(), ''] : [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
  );
  if (fields.name !== id) return { ok: false, error: `${where}: name must be ${id}` };
  if (!fields.description) return { ok: false, error: `${where}: needs a description` };
  const version = Number(fields.version);
  if (!Number.isInteger(version) || version < 1)
    return { ok: false, error: `${where}: version must be a whole number from 1` };
  const body = m[2]!.trim();
  const missing = SKILL_SECTIONS.filter(
    (s) => !body.includes(`\n${s}\n`) && !body.startsWith(`${s}\n`),
  );
  if (missing.length) return { ok: false, error: `${where}: missing ${missing.join(', ')}` };
  return { ok: true, skill: { id, description: fields.description, version, body } };
}
