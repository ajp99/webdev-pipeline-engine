import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  MAX_UPLOAD_MB,
  questionIds,
  validateTemplate,
  type IntakeTemplate,
  type TemplateQuestion,
} from './template';

const root = join(fileURLToPath(import.meta.url), '../../../..');
const generic = JSON.parse(readFileSync(join(root, 'templates/intake/generic.v1.json'), 'utf8'));

function tpl(...questions: Record<string, unknown>[]) {
  return {
    industry: 'dental',
    version: 1,
    sections: [{ id: 's1', title: 'S', questions }],
  };
}
const short = (id = 'q1', extra = {}) => ({
  id,
  type: 'short_text',
  label: 'Q',
  required: false,
  ...extra,
});
const opts = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
];
function errorsOf(input: unknown): string[] {
  const r = validateTemplate(input);
  if (r.ok) throw new Error('expected the template to be rejected');
  return r.errors;
}

describe('the template schema accepts every question type', () => {
  it('accepts all six types in one template', () => {
    const r = validateTemplate(
      tpl(
        short('q1'),
        { id: 'q2', type: 'long_text', label: 'Q', required: true },
        { id: 'q3', type: 'single_choice', label: 'Q', required: true, options: opts },
        {
          id: 'q4',
          type: 'multiple_choice',
          label: 'Q',
          required: false,
          options: opts,
          max_selections: 2,
        },
        { id: 'q5', type: 'file_upload', label: 'Q', required: false, accept: ['png', 'pdf'] },
        { id: 'q6', type: 'links', label: 'Q', required: false },
      ),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      const upload = r.template.sections[0]!.questions[4] as Extract<
        TemplateQuestion,
        { type: 'file_upload' }
      >;
      expect(upload.max_mb).toBe(MAX_UPLOAD_MB);
      expect(upload.none_allowed).toBe(false);
    }
  });
});

describe('the template schema rejects bad edits with clear errors', () => {
  it('requires the required flag on every question', () => {
    const q = short();
    delete (q as Record<string, unknown>).required;
    expect(errorsOf(tpl(q)).join('\n')).toMatch(
      /sections\[1\]\.questions\[1\]\.required: required must be true or false/,
    );
  });
  it('rejects an unknown question type', () => {
    expect(errorsOf(tpl({ ...short(), type: 'date' })).length).toBeGreaterThan(0);
  });
  it('rejects a choice question with fewer than 2 options', () => {
    const e = errorsOf(
      tpl({ id: 'q1', type: 'single_choice', label: 'Q', required: true, options: [opts[0]] }),
    );
    expect(e.join('\n')).toMatch(/options: needs at least 2 options/);
  });
  it('rejects duplicate option values', () => {
    const e = errorsOf(
      tpl({
        id: 'q1',
        type: 'single_choice',
        label: 'Q',
        required: true,
        options: [opts[0], opts[0]],
      }),
    );
    expect(e.join('\n')).toMatch(/option values must be unique/);
  });
  it('rejects max_selections above the number of options', () => {
    const e = errorsOf(
      tpl({
        id: 'q1',
        type: 'multiple_choice',
        label: 'Q',
        required: true,
        options: opts,
        max_selections: 3,
      }),
    );
    expect(e.join('\n')).toMatch(/max_selections \(3\) is more than the number of options \(2\)/);
  });
  it('rejects file types that are not allowed, such as zip', () => {
    const e = errorsOf(
      tpl({ id: 'q1', type: 'file_upload', label: 'Q', required: false, accept: ['zip'] }),
    );
    expect(e.join('\n')).toMatch(/accept may only list: png, jpeg/);
  });
  it('rejects a size limit above 25 MB', () => {
    const e = errorsOf(
      tpl({
        id: 'q1',
        type: 'file_upload',
        label: 'Q',
        required: false,
        accept: ['png'],
        max_mb: 30,
      }),
    );
    expect(e.join('\n')).toMatch(/max_mb cannot exceed 25/);
  });
  it('rejects a question id used twice, even across sections', () => {
    const input = tpl(short('same'));
    input.sections.push({ id: 's2', title: 'S2', questions: [short('same')] });
    expect(errorsOf(input).join('\n')).toMatch(
      /sections\[2\]\.questions\[1\]\.id: question id "same" is already used in section "s1"/,
    );
  });
  it('rejects a section id used twice', () => {
    const input = tpl(short('a'));
    input.sections.push({ id: 's1', title: 'S2', questions: [short('b')] });
    expect(errorsOf(input).join('\n')).toMatch(/section id "s1" is used twice/);
  });
  it('rejects an empty section, empty template, bad id and bad version', () => {
    expect(errorsOf(tpl()).join('\n')).toMatch(/a section needs at least one question/);
    expect(errorsOf({ ...tpl(short()), sections: [] }).join('\n')).toMatch(
      /a template needs at least one section/,
    );
    expect(errorsOf(tpl(short('Bad Id'))).join('\n')).toMatch(/lowercase letters/);
    expect(errorsOf({ ...tpl(short()), version: 0 }).join('\n')).toMatch(/version starts at 1/);
  });
  it('rejects unknown fields, so a typo like "requird" is not silently ignored', () => {
    expect(errorsOf(tpl(short('q1', { requird: true }))).length).toBeGreaterThan(0);
  });
  it('rejects input that is not an object', () => {
    expect(validateTemplate('nope').ok).toBe(false);
    expect(validateTemplate(null).ok).toBe(false);
  });
});

describe('the generic template (P2-T01, P2-T15)', () => {
  const r = validateTemplate(generic);
  const t = (r.ok ? r.template : undefined) as IntakeTemplate;
  const design = t?.sections.find((s) => s.id === 'design');
  const q = (id: string) => design?.questions.find((x) => x.id === id);

  it('is valid, version 1, industry generic', () => {
    expect(r.ok, r.ok ? '' : r.errors.join('\n')).toBe(true);
    expect(t.industry).toBe('generic');
    expect(t.version).toBe(1);
  });
  it('has unique question ids and a required flag on each question', () => {
    const ids = questionIds(t);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of t.sections)
      for (const x of s.questions) expect(typeof x.required).toBe('boolean');
  });
  it('has 4 style cards where the client picks 1 or 2', () => {
    const c = q('design_style_cards');
    expect(c?.type).toBe('multiple_choice');
    if (c?.type === 'multiple_choice') {
      expect(c.options).toHaveLength(4);
      expect(c.max_selections).toBe(2);
      expect(c.required).toBe(true);
    }
  });
  it('has layout density, up to 3 reference sites with notes, and an existing-website question', () => {
    expect(q('layout_density')?.type).toBe('single_choice');
    const refs = q('reference_sites');
    expect(refs?.type).toBe('links');
    if (refs?.type === 'links') {
      expect(refs.max_links).toBe(3);
      expect(refs.note_per_link).toBe(true);
    }
    expect(q('existing_website')).toBeDefined();
  });
  it('asks for colors and fonts, a brand guideline upload, imagery style, and things to avoid', () => {
    for (const id of [
      'colors_and_fonts',
      'brand_guideline',
      'imagery_style',
      'imagery_files',
      'things_to_avoid',
    ])
      expect(q(id), id).toBeDefined();
  });
  it('requires a logo or an explicit "none" answer, with images capped at 5 MB', () => {
    const logo = q('logo');
    expect(logo?.type).toBe('file_upload');
    if (logo?.type === 'file_upload') {
      expect(logo.required).toBe(true);
      expect(logo.none_allowed).toBe(true);
      expect(logo.max_mb).toBeLessThanOrEqual(5);
    }
    const imgs = q('imagery_files');
    if (imgs?.type === 'file_upload') expect(imgs.max_mb).toBeLessThanOrEqual(5);
  });
});
