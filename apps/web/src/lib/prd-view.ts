// The PRD and change-request console (P2-T08 to P2-T10): pure helpers, so they are tested without a database.
import {
  changedSections,
  PRD_SECTIONS,
  prdProblem,
  prdVersionLabel,
  SPAM_PROTECTION,
  type PrdContent,
  type SpamProtection,
} from '@wpe/shared';

export type DiffLine = { kind: 'same' | 'add' | 'del'; text: string };

/** Lines of `a` and `b` past which the diff stops comparing and shows the whole text as replaced. */
const DIFF_MAX_LINES = 2000;

/** A line diff (longest common subsequence) from version a to version b. */
export function lineDiff(a: string, b: string): DiffLine[] {
  const x = a.split('\n');
  const y = b.split('\n');
  if (x.length > DIFF_MAX_LINES || y.length > DIFF_MAX_LINES)
    return [
      ...x.map((text) => ({ kind: 'del' as const, text })),
      ...y.map((text) => ({ kind: 'add' as const, text })),
    ];
  const n = x.length;
  const m = y.length;
  // lcs[i][j]: the longest common run of x[i..] and y[j..].
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i]![j] =
        x[i] === y[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      out.push({ kind: 'same', text: x[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) out.push({ kind: 'del', text: x[i++]! });
    else out.push({ kind: 'add', text: y[j++]! });
  }
  while (i < n) out.push({ kind: 'del', text: x[i++]! });
  while (j < m) out.push({ kind: 'add', text: y[j++]! });
  return out;
}

export type PrdVersionRow = {
  id: string;
  version: number;
  status: string;
  created_at: string;
  created_by: string | null;
  change_request_id: string | null;
  content: unknown;
};

/** The version the client signed (an approval with role client), or null before the sign-off. */
export function signedVersion(
  versions: { id: string; version: number }[],
  clientApprovedIds: string[],
): number | null {
  const signed = versions.filter((v) => clientApprovedIds.includes(v.id)).map((v) => v.version);
  return signed.length ? Math.min(...signed) : null;
}

/** The label, author and the change request of each version, newest first (D-326). */
export function versionList(rows: PrdVersionRow[], signed: number | null) {
  return [...rows]
    .sort((a, b) => b.version - a.version)
    .map((r) => ({
      ...r,
      label: prdVersionLabel(r.version, signed),
      author: r.created_by ? 'Owner' : 'Agent',
    }));
}

/** The summary the editor starts with: the changed sections, for the owner to turn into a sentence (D-324). */
export function defaultSummary(before: PrdContent | null, after: PrdContent): string {
  if (!before) return 'First version written by the owner.';
  const changed: string[] = changedSections(before, after).map(
    (k) => PRD_SECTIONS.find((s) => s.key === k)!.title,
  );
  if (before.spam_protection !== after.spam_protection)
    changed.push('Contact form spam protection');
  return changed.length ? `Changed: ${changed.join('; ')}.` : '';
}

export type FormValues = Record<string, string | undefined>;

/** The editor's form as a PRD, or the problem in words the owner can act on. */
export function prdFromForm(
  f: FormValues,
): { ok: true; content: PrdContent } | { ok: false; error: string } {
  const spam = (f.spam_protection ?? '') as SpamProtection;
  const content: PrdContent = {
    sections: Object.fromEntries(
      PRD_SECTIONS.map((s) => [s.key, (f[`section_${s.key}`] ?? '').replace(/\r\n/g, '\n')]),
    ) as PrdContent['sections'],
    spam_protection: spam,
    change_summary: (f.change_summary ?? '').trim(),
  };
  if (!(SPAM_PROTECTION as readonly string[]).includes(spam))
    return { ok: false, error: 'Choose the contact form spam protection.' };
  if (!/\S/.test(content.change_summary))
    return { ok: false, error: 'Write a short summary of what changed.' };
  const problem = prdProblem(content);
  return problem
    ? { ok: false, error: `The PRD is not valid: ${problem}.` }
    : { ok: true, content };
}

export const LIST_MAX = 50;
export const LIST_ITEM_MAX = 200;

/** A comma- or line-separated list typed by the owner, trimmed, without blanks or repeats. */
export function parseList(
  text: string,
): { ok: true; items: string[] } | { ok: false; error: string } {
  const items = [
    ...new Set(
      text
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  if (items.length > LIST_MAX) return { ok: false, error: `List at most ${LIST_MAX} items.` };
  if (items.some((s) => [...s].length > LIST_ITEM_MAX))
    return { ok: false, error: `Each item can be at most ${LIST_ITEM_MAX} characters.` };
  return { ok: true, items };
}

export const DECISIONS = [
  { value: 'accept_current_round', label: 'Accept into the current round' },
  { value: 'defer', label: 'Defer to a later round' },
  { value: 'decline', label: 'Decline' },
] as const;

/** What the owner can do with a change request now. */
export function changeRequestNext(cr: {
  status: string;
  decision: string | null;
  hasPrdVersion: boolean;
}): 'decide' | 'write_prd' | 'done' {
  if (cr.status === 'received') return 'decide';
  if (cr.status === 'accepted' && cr.decision === 'accept_current_round' && !cr.hasPrdVersion)
    return 'write_prd';
  return 'done';
}
