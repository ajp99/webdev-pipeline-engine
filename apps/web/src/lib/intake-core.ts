// What the console does to an intake round (P2-T03). Each function checks the round rules from
// @wpe/shared, then asks the store to write. The store is a small interface so the rules are tested
// without a database; intake-store.ts is the Supabase version.
import {
  missingRequired,
  roundAllows,
  type Answers,
  type IntakeTemplate,
  type RoundAction,
  type RoundStatus,
  type UploadCounts,
} from '@wpe/shared';
import { parseSection, type FormFields } from './intake-form';

export type RoundRow = { round: number; status: RoundStatus };

export interface IntakeStore {
  /** The latest round of the project, or null when the project has none. */
  latestRound(projectId: string): Promise<RoundRow | null>;
  answers(projectId: string, round: number): Promise<Answers>;
  uploadCounts(projectId: string): Promise<UploadCounts>;
  /** A null answer removes the row. */
  saveAnswers(projectId: string, round: number, answers: Answers): Promise<void>;
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
  await store.saveAnswers(projectId, cur.row!.round, answers);
  return { ok: true, notice: 'Saved' };
}

export async function submitRound(
  store: IntakeStore,
  template: IntakeTemplate,
  projectId: string,
): Promise<Outcome> {
  const cur = await currentRound(store, projectId, 'submit');
  if (cur.error) return cur.error;
  // Required fields are the template's, so they apply to round 1; later rounds hold follow-ups.
  if (cur.row!.round === 1) {
    const missing = missingRequired(
      template,
      await store.answers(projectId, 1),
      await store.uploadCounts(projectId),
    );
    if (missing.length > 0)
      return fail(
        `Required answers are missing: ${missing.map((m) => `${m.label} (${m.section})`).join('; ')}`,
      );
  }
  const moved = await store.moveRound(projectId, cur.row!.round, 'open', 'submitted');
  return moved
    ? { ok: true, notice: 'Round submitted' }
    : fail('the round changed; reload the page');
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
