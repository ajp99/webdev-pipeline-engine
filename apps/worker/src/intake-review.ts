// The intake review run (P2-T05): reads a submitted round, asks the model for follow-up questions and
// gaps, and hands the checked reply to the database, which locks the round and opens the next one.
// The model call is a plain request with a JSON schema, not an Agent SDK run (D-275).
import {
  buildReviewPrompt,
  capNotes,
  effectiveAnswers,
  REVIEW_JSON_SCHEMA,
  reviewReplySchema,
  toCompletion,
  validateTemplate,
  type Completion,
  type FollowUpHistory,
  type ReviewInput,
  type ReviewReply,
  type UploadCounts,
} from '@wpe/shared';
import type { Handler } from './runner';
import { generateChecked, type ModelClient, type Parsed } from './model';

export interface ReviewDeps {
  /** What the model needs, or null when there is nothing to review (no submitted round, stage moved on). */
  load(projectId: string): Promise<ReviewInput | null>;
  /** complete_intake_review: artifact, lock and next round in one transaction. */
  complete(projectId: string, round: number, c: Completion, model: string): Promise<void>;
}

function parseReply(raw: unknown): Parsed<ReviewReply> {
  const r = reviewReplySchema.safeParse(raw);
  if (r.success) return { ok: true, value: r.data };
  const why = r.error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join('.') || 'reply'}: ${i.message}`)
    .join('; ');
  return { ok: false, error: why };
}

export function intakeReviewHandler(deps: ReviewDeps, model: ModelClient): Handler {
  return async ({ run, signal, progress }) => {
    progress();
    const input = await deps.load(run.project_id);
    // The owner reopened the round, or the stage moved on, before this run was claimed.
    if (!input) return { tokens: 0 };
    const { system, user } = buildReviewPrompt(input);
    const { value, tokens } = await generateChecked(
      model,
      { system, user, schema: REVIEW_JSON_SCHEMA, signal, progress },
      parseReply,
    );
    // A cancel that arrived while the model was thinking wins: nothing is written.
    if (signal.aborted) throw new Error('stopped');
    await deps.complete(run.project_id, input.round, toCompletion(value, input.round), model.name);
    progress();
    return { tokens };
  };
}

/** The handler when no model is configured: the run fails with the reason instead of the worker crashing. */
export function unconfiguredReviewHandler(reason: string): Handler {
  return async () => {
    throw new Error(reason);
  };
}

// ---- Assembling the model input from database rows (pure, tested) ----

export type ReviewRows = {
  snapshot: unknown;
  round: number;
  /** Every answer row. A follow-up row (agent or owner) also carries its question text (P2-T06). */
  responses: { round: number; question_id: string; answer: unknown; question?: string | null }[];
  uploadKinds: string[];
  /** The owner's private notes, newest first. */
  notes?: string[];
  /** The owner's Feedback since the last review, oldest first. */
  feedback?: string[];
};

export function assembleReviewInput(rows: ReviewRows): ReviewInput {
  const check = validateTemplate(rows.snapshot);
  if (!check.ok) throw new Error(`the project's intake template is not valid: ${check.errors[0]}`);
  const answers = effectiveAnswers(rows.responses);
  const uploads: UploadCounts = {};
  for (const k of rows.uploadKinds) uploads[k] = (uploads[k] ?? 0) + 1;
  // The follow-up questions are the rows that hold a question text, so a question the owner added counts
  // and one the owner removed does not (its row is gone). Oldest round first.
  const history: FollowUpHistory[] = rows.responses
    .filter((r) => typeof r.question === 'string' && r.question.trim() !== '')
    .sort(
      (x, y) =>
        x.round - y.round || x.question_id.localeCompare(y.question_id, 'en', { numeric: true }),
    )
    .map((r) => {
      const a = answers[r.question_id];
      return {
        id: r.question_id,
        text: r.question as string,
        answer: typeof a === 'string' && a.trim() ? a : null,
      };
    });
  const ownerNotes = capNotes(rows.notes ?? []);
  const feedback = (rows.feedback ?? []).map((f) => f.trim()).filter((f) => f !== '');
  return {
    template: check.template,
    answers,
    uploads,
    history,
    round: rows.round,
    ...(ownerNotes.length > 0 ? { ownerNotes } : {}),
    ...(feedback.length > 0 ? { feedback } : {}),
  };
}
