// What the console does to an intake round (P2-T03). Each function checks the round rules from
// @wpe/shared, then asks the store to write. The store is a small interface so the rules are tested
// without a database; intake-store.ts is the Supabase version.
import {
  MAX_TEXT_CHARS,
  missingRequired,
  roundAllows,
  type Answers,
  type IntakeTemplate,
  type RoundAction,
  type ReviewRecord,
  type RoundStatus,
  type UploadCounts,
} from '@wpe/shared';
import { parseSection, type FormFields } from './intake-form';

export type RoundRow = { round: number; status: RoundStatus };

/** A follow-up question as a row of the round: the agent's or one the owner added (P2-T06). */
export type QuestionRow = { id: string; text: string; askedBy: 'agent' | 'owner' };
export type Followup = QuestionRow & { reason: string };

/** The longest question text the database accepts. */
export const MAX_QUESTION_CHARS = 500;

export interface IntakeStore {
  /** The latest round of the project, or null when the project has none. */
  latestRound(projectId: string): Promise<RoundRow | null>;
  answers(projectId: string, round: number): Promise<Answers>;
  /** Every round's answers merged, the newest round winning (P2-T05). */
  effectiveAnswers(projectId: string): Promise<Answers>;
  uploadCounts(projectId: string): Promise<UploadCounts>;
  /** A null answer removes the row. */
  saveAnswers(projectId: string, round: number, answers: Answers): Promise<void>;
  /** The owner's answers to the agent's follow-up questions; a null removes the row. */
  saveFollowupAnswers(
    projectId: string,
    round: number,
    answers: Record<string, string | null>,
  ): Promise<void>;
  /** The follow-up question rows of a round, in id order. */
  followupRows(projectId: string, round: number): Promise<QuestionRow[]>;
  /** Adds an owner question to the round (id `ow<round>_<n>`); returns the new id. */
  addQuestion(projectId: string, round: number, text: string): Promise<string>;
  /** Deletes a follow-up row (its question and answer); false when there was no such row. */
  removeQuestion(projectId: string, round: number, questionId: string): Promise<boolean>;
  /** The newest review of the agent, or null before the first one. */
  latestReview(projectId: string): Promise<ReviewRecord | null>;
  /** True while a review run is queued, running, waiting or being cancelled. */
  reviewRunActive(projectId: string): Promise<boolean>;
  /** The status of the newest review run, or null when there was none. */
  lastReviewStatus(projectId: string): Promise<string | null>;
  /** Puts a review run on the queue; throws the database's message when it refuses. */
  enqueueReview(projectId: string): Promise<void>;
  /** Moves the round from one status to another; false when it was not in the `from` status any more. */
  moveRound(projectId: string, round: number, from: RoundStatus, to: RoundStatus): Promise<boolean>;
}

export type Outcome = { ok: true; notice?: string } | { ok: false; message: string };
const fail = (message: string): Outcome => ({ ok: false, message });

type Current = { row: RoundRow; error?: undefined } | { row?: undefined; error: Outcome };

async function currentRound(
  store: IntakeStore,
  projectId: string,
  action: RoundAction,
): Promise<Current> {
  const row = await store.latestRound(projectId);
  if (!row) return { error: fail('this project has no intake round') };
  const allowed = roundAllows(row.status, action);
  if (!allowed.ok) return { error: fail(allowed.reason) };
  return { row };
}

export async function saveSection(
  store: IntakeStore,
  template: IntakeTemplate,
  projectId: string,
  sectionId: string,
  fields: FormFields,
): Promise<Outcome> {
  const section = template.sections.find((s) => s.id === sectionId);
  if (!section) return fail('unknown section');
  const cur = await currentRound(store, projectId, 'save');
  if (cur.error) return cur.error;
  const { answers, problems } = parseSection(section, fields);
  if (problems.length > 0) return fail(problems.map((p) => `${p.label}: ${p.message}`).join('; '));
  const round = cur.row!.round;
  let toWrite = answers;
  if (round > 1) {
    // A later round records only what changed, so the newest-round-wins merge stays meaningful.
    const before = await store.effectiveAnswers(projectId);
    toWrite = Object.fromEntries(
      Object.entries(answers).filter(
        ([id, v]) => JSON.stringify(v ?? null) !== JSON.stringify(before[id] ?? null),
      ),
    );
  }
  await store.saveAnswers(projectId, round, toWrite);
  return { ok: true, notice: 'Saved' };
}

export async function submitRound(
  store: IntakeStore,
  template: IntakeTemplate,
  projectId: string,
): Promise<Outcome> {
  const cur = await currentRound(store, projectId, 'submit');
  if (cur.error) return cur.error;
  const round = cur.row!.round;
  const answers = await store.effectiveAnswers(projectId);
  const missing = missingRequired(template, answers, await store.uploadCounts(projectId));
  if (missing.length > 0)
    return fail(
      `Required answers are missing: ${missing.map((m) => `${m.label} (${m.section})`).join('; ')}`,
    );
  const unanswered = (await followupsFor(store, projectId, round)).filter(
    (q) => !isText(answers[q.id]),
  );
  if (unanswered.length > 0)
    return fail(
      `Answer every follow-up question first (${unanswered.length} left); write "not known" if you cannot`,
    );
  const moved = await store.moveRound(projectId, cur.row!.round, 'open', 'submitted');
  return moved
    ? { ok: true, notice: 'Round submitted' }
    : fail('the round changed; reload the page');
}

const isText = (a: unknown) => typeof a === 'string' && a.trim() !== '';

/**
 * The follow-up questions a round holds: its question rows, which are the agent's follow-ups from the
 * review of the round before it and the questions the owner added. The reason the agent gave comes from
 * the saved review.
 */
export async function followupsFor(
  store: IntakeStore,
  projectId: string,
  round: number,
): Promise<Followup[]> {
  const rows = await store.followupRows(projectId, round);
  if (rows.length === 0) return [];
  const review = await store.latestReview(projectId);
  const reasons = new Map((review?.followups ?? []).map((f) => [f.id, f.reason]));
  return rows.map((r) => ({ ...r, reason: reasons.get(r.id) ?? '' }));
}

/** The owner adds a question to the open round; the client sees it with the agent's follow-ups. */
export async function addOwnerQuestion(
  store: IntakeStore,
  projectId: string,
  text: string,
): Promise<Outcome> {
  const cur = await currentRound(store, projectId, 'save');
  if (cur.error) return cur.error;
  const t = text.trim();
  if (t === '') return fail('Write the question first');
  if (t.length > MAX_QUESTION_CHARS)
    return fail(`A question has at most ${MAX_QUESTION_CHARS} characters`);
  await store.addQuestion(projectId, cur.row!.round, t);
  return { ok: true, notice: 'Question added' };
}

/** The owner removes a follow-up (the agent's or their own) from the open round. A template question stays. */
export async function removeFollowup(
  store: IntakeStore,
  projectId: string,
  questionId: string,
): Promise<Outcome> {
  const cur = await currentRound(store, projectId, 'save');
  if (cur.error) return cur.error;
  const gone = await store.removeQuestion(projectId, cur.row!.round, questionId);
  return gone
    ? { ok: true, notice: 'Question removed' }
    : fail('That question is not a follow-up of this round');
}

export const followupField = (id: string) => `fu_${id}`;

export async function saveFollowups(
  store: IntakeStore,
  projectId: string,
  fields: FormFields,
): Promise<Outcome> {
  const cur = await currentRound(store, projectId, 'save');
  if (cur.error) return cur.error;
  const questions = await followupsFor(store, projectId, cur.row!.round);
  if (questions.length === 0) return fail('this round has no follow-up questions');
  const out: Record<string, string | null> = {};
  for (const q of questions) {
    const v = (fields.get(followupField(q.id)) ?? '').trim();
    if (v.length > MAX_TEXT_CHARS) return fail(`${q.text}: at most ${MAX_TEXT_CHARS} characters`);
    out[q.id] = v === '' ? null : v;
  }
  await store.saveFollowupAnswers(projectId, cur.row!.round, out);
  return { ok: true, notice: 'Saved' };
}

/** Queues the agent's review of a submitted round. Only one review at a time. */
export async function startReview(store: IntakeStore, projectId: string): Promise<Outcome> {
  const row = await store.latestRound(projectId);
  if (!row) return fail('this project has no intake round');
  if (row.status !== 'submitted')
    return fail(
      row.status === 'open'
        ? 'Submit the round before the review'
        : 'This round is already reviewed',
    );
  if (await store.reviewRunActive(projectId)) return fail('A review is already queued or running');
  try {
    await store.enqueueReview(projectId);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'could not queue the review');
  }
  return { ok: true, notice: 'Review queued; the runner picks it up' };
}

export async function reopenRound(store: IntakeStore, projectId: string): Promise<Outcome> {
  const cur = await currentRound(store, projectId, 'reopen');
  if (cur.error) return cur.error;
  const moved = await store.moveRound(projectId, cur.row!.round, 'submitted', 'open');
  return moved
    ? { ok: true, notice: 'Round reopened' }
    : fail('the round changed; reload the page');
}

export async function unlockRound(store: IntakeStore, projectId: string): Promise<Outcome> {
  const cur = await currentRound(store, projectId, 'unlock');
  if (cur.error) return cur.error;
  const moved = await store.moveRound(projectId, cur.row!.round, 'reviewed', 'open');
  return moved
    ? { ok: true, notice: 'Round unlocked' }
    : fail('the round changed; reload the page');
}

/** Files may be added or removed only while the round is open, like answers. */
export async function canChangeFiles(store: IntakeStore, projectId: string): Promise<Outcome> {
  const cur = await currentRound(store, projectId, 'save');
  return cur.error ?? { ok: true };
}
