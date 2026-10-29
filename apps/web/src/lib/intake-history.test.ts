import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateTemplate } from '@wpe/shared';
import { buildHistory, type HistoryRow } from './intake-history';

const root = join(fileURLToPath(import.meta.url), '../../../../..');
const check = validateTemplate(
  JSON.parse(readFileSync(join(root, 'templates/intake/generic.v1.json'), 'utf8')),
);
if (!check.ok) throw new Error(check.errors.join('\n'));
const template = check.template;

const row = (over: Partial<HistoryRow>): HistoryRow => ({
  round: 1,
  question_id: 'business_name',
  answer: 'Acme',
  asked_by: 'template',
  question: null,
  ...over,
});

describe('buildHistory', () => {
  it('lists rounds in order, template answers first, then follow-ups by number', () => {
    const h = buildHistory(
      template,
      [
        row({
          round: 2,
          question_id: 'fu2_10',
          asked_by: 'agent',
          question: 'Tenth?',
          answer: 'x',
        }),
        row({
          round: 2,
          question_id: 'fu2_2',
          asked_by: 'agent',
          question: 'Second?',
          answer: null,
        }),
        row({
          round: 2,
          question_id: 'ow2_1',
          asked_by: 'owner',
          question: 'Domain?',
          answer: 'yes',
        }),
        row({ round: 2, question_id: 'business_name', answer: 'Acme Plumbing' }),
        row({ round: 1 }),
      ],
      {},
    );
    expect(h.map((r) => r.round)).toEqual([1, 2]);
    expect(h[1]!.items.map((i) => i.id)).toEqual(['business_name', 'fu2_2', 'fu2_10', 'ow2_1']);
    expect(h[1]!.items.map((i) => i.kind)).toEqual(['template', 'agent', 'agent', 'owner']);
  });

  it('shows the question text for a follow-up, the template label for a template question', () => {
    const [r1] = buildHistory(template, [row({})], {});
    expect(r1!.items[0]).toMatchObject({ label: expect.stringMatching(/\w/), answer: 'Acme' });
    const [r2] = buildHistory(
      template,
      [
        row({
          round: 2,
          question_id: 'fu2_1',
          asked_by: 'agent',
          question: 'Which pages?',
          answer: 'Home',
        }),
      ],
      {},
    );
    expect(r2!.items[0]).toEqual({
      id: 'fu2_1',
      label: 'Which pages?',
      kind: 'agent',
      answer: 'Home',
    });
  });

  it('gives an empty answer as null and survives a question the template no longer has', () => {
    const [r] = buildHistory(template, [row({ question_id: 'gone', answer: ' ' })], {});
    expect(r!.items[0]).toMatchObject({ id: 'gone', label: 'gone', answer: null });
  });
});
