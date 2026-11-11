// The intake page's history (P2-T06): every round's answers, the follow-up questions with their answers,
// and the Feedback the owner sent. Pure, so it is tested without a database.
import { describeAnswer, type Answers, type IntakeTemplate, type UploadCounts } from '@wpe/shared';

export type HistoryRow = {
  round: number;
  question_id: string;
  answer: unknown;
  asked_by: string;
  question: string | null;
};

export type HistoryItem = {
  id: string;
  label: string;
  kind: 'template' | 'agent' | 'owner';
  /** Plain text of the answer, or null when it is empty. */
  answer: string | null;
};

export type HistoryRound = { round: number; items: HistoryItem[] };

const asText = (v: string | string[] | null) => (Array.isArray(v) ? v.join(', ') : v);

/** Rounds in order; in each, the template answers in template order, then the follow-ups by id. */
export function buildHistory(
  template: IntakeTemplate,
  rows: HistoryRow[],
  uploads: UploadCounts,
): HistoryRound[] {
  const questions = new Map(template.sections.flatMap((s) => s.questions).map((q) => [q.id, q]));
  const order = new Map([...questions.keys()].map((id, i) => [id, i]));
  const byRound = new Map<number, HistoryRow[]>();
  for (const r of rows) byRound.set(r.round, [...(byRound.get(r.round) ?? []), r]);
  return [...byRound.keys()]
    .sort((a, b) => a - b)
    .map((round) => {
      const list = byRound.get(round)!;
      const items = list
        .map((r): HistoryItem => {
          const q = questions.get(r.question_id);
          if (r.asked_by === 'template' || !r.question) {
            const a = r.answer as Answers[string];
            return {
              id: r.question_id,
              label: q?.label ?? r.question_id,
              kind: 'template',
              answer: q
                ? asText(describeAnswer(q, a, uploads[r.question_id] ?? 0))
                : typeof a === 'string' && a.trim()
                  ? a
                  : null,
            };
          }
          const a = r.answer;
          return {
            id: r.question_id,
            label: r.question,
            kind: r.asked_by === 'owner' ? 'owner' : 'agent',
            answer: typeof a === 'string' && a.trim() ? a : null,
          };
        })
        .sort((x, y) => {
          if (x.kind === 'template' && y.kind === 'template')
            return (order.get(x.id) ?? 1e9) - (order.get(y.id) ?? 1e9);
          if (x.kind === 'template') return -1;
          if (y.kind === 'template') return 1;
          return x.id.localeCompare(y.id, 'en', { numeric: true });
        });
      return { round, items };
    });
}
