// Intake answers and round rules (P2-T03, D-079, D-298). The owner enters the intake in the
// console; these rules decide what a saved answer may look like, which questions block Submit, and
// which round moves are allowed. The console calls them before it writes; the database holds the
// rows only (the owner may write any row, so these rules are in the app by the owner's choice).
import type { IntakeTemplate, TemplateQuestion } from './template';

export type RoundStatus = 'open' | 'submitted' | 'reviewed';

/** Stored answer value per question type. */
export type LinkAnswer = { url: string; note?: string };
export type FileAnswer = { none: boolean };
export type Answer = string | string[] | LinkAnswer[] | FileAnswer;
export type Answers = Record<string, Answer | null | undefined>;

export const MAX_TEXT_CHARS = 5000;
export const MAX_SHORT_TEXT_CHARS = 300;

const isHttpUrl = (s: string) => {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

/** Returns a plain-language problem with an answer, or null when it can be saved. */
export function answerProblem(q: TemplateQuestion, a: unknown): string | null {
  if (a === null || a === undefined) return null; // clearing an answer is always allowed
  switch (q.type) {
    case 'short_text':
    case 'long_text': {
      if (typeof a !== 'string') return 'the answer must be text';
      const max = q.type === 'short_text' ? MAX_SHORT_TEXT_CHARS : MAX_TEXT_CHARS;
      return a.length > max ? `the answer is longer than ${max} characters` : null;
    }
    case 'single_choice':
      if (typeof a !== 'string' || !q.options.some((o) => o.value === a))
        return 'pick one of the listed options';
      return null;
    case 'multiple_choice': {
      if (!Array.isArray(a) || a.some((v) => typeof v !== 'string')) return 'pick from the list';
      if (new Set(a).size !== a.length) return 'an option is picked twice';
      if (a.some((v) => !q.options.some((o) => o.value === v))) return 'pick only listed options';
      if (q.max_selections !== undefined && a.length > q.max_selections)
        return `pick at most ${q.max_selections}`;
      return null;
    }
    case 'links': {
      if (!Array.isArray(a)) return 'the links must be a list';
      if (a.length > q.max_links) return `at most ${q.max_links} links`;
      for (const l of a as unknown[]) {
        if (typeof l !== 'object' || l === null || typeof (l as LinkAnswer).url !== 'string')
          return 'each link needs a web address';
        const { url, note } = l as LinkAnswer;
        if (!isHttpUrl(url)) return `"${url}" is not a web address starting with http or https`;
        if (note !== undefined && (typeof note !== 'string' || note.length > MAX_TEXT_CHARS))
          return 'a link note is too long';
      }
      return null;
    }
    case 'file_upload':
      if (typeof a !== 'object' || a === null || typeof (a as FileAnswer).none !== 'boolean')
        return 'the answer must say whether there is no file';
      return null;
  }
}

/** Number of uploaded files per question id (uploads.kind holds the question id). */
export type UploadCounts = Record<string, number>;

export function isAnswered(
  q: TemplateQuestion,
  a: Answer | null | undefined,
  uploads: UploadCounts,
) {
  switch (q.type) {
    case 'short_text':
    case 'long_text':
      return typeof a === 'string' && a.trim().length > 0;
    case 'single_choice':
      return typeof a === 'string' && a.length > 0;
    case 'multiple_choice':
    case 'links':
      return Array.isArray(a) && a.length > 0;
    case 'file_upload':
      // A file, or the explicit "there is none" when the template allows it.
      return (
        (uploads[q.id] ?? 0) > 0 || (q.none_allowed && (a as FileAnswer | undefined)?.none === true)
      );
  }
}

export type MissingField = { id: string; label: string; section: string };

/** Required questions without an answer: these block Submit. Everything else is optional. */
export function missingRequired(
  t: IntakeTemplate,
  answers: Answers,
  uploads: UploadCounts = {},
): MissingField[] {
  return t.sections.flatMap((s) =>
    s.questions
      .filter((q) => q.required && !isAnswered(q, answers[q.id], uploads))
      .map((q) => ({ id: q.id, label: q.label, section: s.title })),
  );
}

export type RoundAction = 'save' | 'submit' | 'reopen' | 'unlock';
export type Allowed = { ok: true } | { ok: false; reason: string };

/**
 * What the owner may do to a round in each state:
 * save answers (open only); submit (open only); reopen (submitted, until the agent has reviewed it);
 * unlock (reviewed; only the owner can, D-079). The agent's review (P2-T05) moves submitted to reviewed.
 */
export function roundAllows(status: RoundStatus, action: RoundAction): Allowed {
  const ok: Allowed = { ok: true };
  switch (action) {
    case 'save':
    case 'submit':
      return status === 'open'
        ? ok
        : { ok: false, reason: `this round is ${status}; reopen it to change answers` };
    case 'reopen':
      return status === 'submitted'
        ? ok
        : {
            ok: false,
            reason:
              status === 'reviewed'
                ? 'the agent has reviewed this round; unlock it instead'
                : 'the round is already open',
          };
    case 'unlock':
      return status === 'reviewed'
        ? ok
        : { ok: false, reason: 'only a reviewed round is unlocked' };
  }
}

export function roundStatusLabel(status: RoundStatus): string {
  return { open: 'Open', submitted: 'Submitted', reviewed: 'Reviewed (locked)' }[status];
}
