// The PRD as the database stores it (D-325): six fixed markdown sections, the contact form's spam protection
// and a summary of what changed. `prdProblem` repeats the database's check
// (private.prd_content_problem in supabase/migrations/0001_init.sql), so the console and the worker can say
// what is wrong before the database refuses it. Keep the two in step; prd.test.ts holds the same cases.

export const PRD_SECTIONS = [
  { key: 'business', title: 'Business summary, goals and audience' },
  { key: 'site_map', title: 'Site map and pages' },
  { key: 'features', title: 'Features' },
  { key: 'content', title: 'Content inventory' },
  { key: 'brand', title: 'Brand inputs' },
  { key: 'non_functional', title: 'Non-functional targets' },
] as const;

export type PrdSectionKey = (typeof PRD_SECTIONS)[number]['key'];
export const SPAM_PROTECTION = ['honeypot', 'turnstile', 'no_contact_form'] as const;
export type SpamProtection = (typeof SPAM_PROTECTION)[number];

export type PrdContent = {
  sections: Record<PrdSectionKey, string>;
  spam_protection: SpamProtection;
  change_summary: string;
};

export type PrdNotes = {
  gaps: { issue: string; resolution?: string }[];
  conflicts: { issue: string; resolution?: string }[];
};

export const PRD_SECTION_MAX = 20_000;
export const PRD_SUMMARY_MAX = 1000;
export const PRD_NOTES_MAX_ITEMS = 50;
export const PRD_NOTE_MAX = 1000;

/** Length in characters (code points), as Postgres length() counts, not UTF-16 units. */
export const chars = (s: string) => [...s].length;
/** True when the text has a character other than whitespace (Postgres: x ~ '\S'). */
const hasText = (s: string) => /\S/.test(s);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Null when the content is a valid PRD, or the problem in the database's words. A stored version may also carry `model`. */
export function prdProblem(c: unknown): string | null {
  if (!isObject(c)) return 'the PRD must be an object';
  if (
    Object.keys(c).some(
      (k) => !['sections', 'spam_protection', 'change_summary', 'model'].includes(k),
    )
  )
    return 'the PRD has a key other than sections, spam_protection and change_summary';
  const sections = c.sections;
  if (!isObject(sections)) return 'the PRD needs a sections object';
  const keys: readonly string[] = PRD_SECTIONS.map((s) => s.key);
  if (Object.keys(sections).some((k) => !keys.includes(k)))
    return `the PRD has a section that is not one of ${keys.join(', ')}`;
  for (const k of keys) {
    const v = sections[k];
    if (typeof v !== 'string' || !hasText(v)) return `the PRD section ${k} is missing or empty`;
    if (chars(v) > PRD_SECTION_MAX)
      return `the PRD section ${k} is over ${PRD_SECTION_MAX} characters`;
  }
  const siteMap = sections.site_map as string;
  if (!/privacy/i.test(siteMap) || !/cookie/i.test(siteMap))
    return 'the site map must list a privacy policy and a cookie notice';
  if (
    typeof c.spam_protection !== 'string' ||
    !(SPAM_PROTECTION as readonly string[]).includes(c.spam_protection)
  )
    return 'spam_protection must be honeypot, turnstile or no_contact_form';
  if (typeof c.change_summary !== 'string' || chars(c.change_summary) > PRD_SUMMARY_MAX)
    return `change_summary must be a string of at most ${PRD_SUMMARY_MAX} characters`;
  return null;
}

/** Null when the notes are valid (private.prd_notes_problem), or the problem. */
export function prdNotesProblem(c: unknown): string | null {
  if (!isObject(c)) return 'the notes must be an object';
  if (Object.keys(c).some((k) => k !== 'gaps' && k !== 'conflicts'))
    return 'the notes have a key other than gaps and conflicts';
  for (const k of ['gaps', 'conflicts'] as const) {
    const list = c[k];
    if (!Array.isArray(list)) return `the notes need a ${k} list`;
    if (list.length > PRD_NOTES_MAX_ITEMS)
      return `the notes have more than ${PRD_NOTES_MAX_ITEMS} ${k}`;
    for (const it of list) {
      const ok =
        isObject(it) &&
        Object.keys(it).every((x) => x === 'issue' || x === 'resolution') &&
        typeof it.issue === 'string' &&
        it.issue.trim() !== '' &&
        it.issue.length <= PRD_NOTE_MAX &&
        (!('resolution' in it) ||
          (typeof it.resolution === 'string' && it.resolution.length <= PRD_NOTE_MAX));
      if (!ok)
        return `each of the ${k} needs an issue (at most ${PRD_NOTE_MAX} characters) and may have a resolution`;
    }
  }
  return null;
}

/** The PRD's sections as a value, or null when the content is not a PRD (for the viewer and the next stage). */
export function asPrd(c: unknown): PrdContent | null {
  return prdProblem(c) === null ? (c as PrdContent) : null;
}

/** Markdown of the whole PRD, one heading per section, for the next stage's agent and for copying to the client. */
export function prdMarkdown(p: PrdContent): string {
  const spam = {
    honeypot: 'honeypot field',
    turnstile: 'Cloudflare Turnstile',
    no_contact_form: 'no contact form',
  }[p.spam_protection];
  return [
    ...PRD_SECTIONS.map((s) => `## ${s.title}\n\n${p.sections[s.key].trim()}`),
    `## Contact form spam protection\n\n${spam}`,
  ].join('\n\n');
}

/** The keys of the sections that differ between two versions, in the fixed order. */
export function changedSections(a: PrdContent, b: PrdContent): PrdSectionKey[] {
  return PRD_SECTIONS.map((s) => s.key).filter((k) => a.sections[k] !== b.sections[k]);
}

/**
 * Display labels (D-326): versions before the client's sign-off are drafts 1, 2, ...; the signed version is
 * v1.0; each version after it (from a change request) is v1.1, v1.2, ... `signed` is the signed version's
 * number, or null before the sign-off.
 */
export function prdVersionLabel(version: number, signed: number | null): string {
  if (signed === null || version < signed) return `Draft ${version}`;
  return `v1.${version - signed}`;
}
