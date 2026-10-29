import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateTemplate } from '@wpe/shared';
import { STYLE_CARD_QUESTION, STYLE_CARDS, styleCardFor } from './style-cards';

const root = join(fileURLToPath(import.meta.url), '../../../../..');
const web = join(root, 'apps/web');
const check = validateTemplate(
  JSON.parse(readFileSync(join(root, 'templates/intake/generic.v1.json'), 'utf8')),
);
if (!check.ok) throw new Error(check.errors.join('\n'));

describe('style cards', () => {
  const question = check.template.sections
    .flatMap((s) => s.questions)
    .find((q) => q.id === STYLE_CARD_QUESTION);

  it('are the four options of the generic template, each with a drawn image in the repo', () => {
    expect(question?.type).toBe('multiple_choice');
    const values = question?.type === 'multiple_choice' ? question.options.map((o) => o.value) : [];
    expect(STYLE_CARDS.map((c) => c.value)).toEqual(values);
    expect(values).toEqual(['minimal', 'bold', 'warm', 'corporate']);
    for (const c of STYLE_CARDS)
      expect(existsSync(join(web, 'public', c.image)), c.image).toBe(true);
  });

  it('are plain pictures: no script, link or event handler in the SVG', () => {
    for (const c of STYLE_CARDS) {
      const svg = readFileSync(join(web, 'public', c.image), 'utf8');
      expect(svg).toMatch(/^<svg /);
      expect(svg).not.toMatch(/<script|href=|\son[a-z]+=/i);
    }
  });

  it('apply to the style question only', () => {
    expect(styleCardFor(STYLE_CARD_QUESTION, 'bold')?.image).toBe('/style-cards/bold.svg');
    expect(styleCardFor('layout_density', 'bold')).toBeUndefined();
    expect(styleCardFor(STYLE_CARD_QUESTION, 'nonsense')).toBeUndefined();
  });
});
