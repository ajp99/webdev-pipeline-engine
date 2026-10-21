import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateTemplate, type TemplateQuestion } from '@wpe/shared';
import { checkUpload, parseSection, safeFileName, type FormFields } from './intake-form';

const root = join(fileURLToPath(import.meta.url), '../../../../..');
const check = validateTemplate(
  JSON.parse(readFileSync(join(root, 'templates/intake/generic.v1.json'), 'utf8')),
);
if (!check.ok) throw new Error(check.errors.join('\n'));
const sections = check.template.sections;
const section = (id: string) => sections.find((s) => s.id === id)!;
const q = (id: string): TemplateQuestion =>
  sections.flatMap((s) => s.questions).find((x) => x.id === id)!;

function form(values: Record<string, string | string[]>): FormFields {
  return {
    get: (n) => {
      const v = values[n];
      return v === undefined ? null : Array.isArray(v) ? (v[0] ?? null) : v;
    },
    getAll: (n) => {
      const v = values[n];
      return v === undefined ? [] : Array.isArray(v) ? v : [v];
    },
  };
}

describe('parseSection', () => {
  it('reads text, trimming spaces, and turns blank into no answer', () => {
    const r = parseSection(
      section('business'),
      form({ q_business_name: '  Acme  ', q_location: '   ' }),
    );
    expect(r.problems).toEqual([]);
    expect(r.answers.business_name).toBe('Acme');
    expect(r.answers.location).toBeNull();
  });

  it('reads several picks and links with notes', () => {
    const style = (q('design_style_cards') as { options: { value: string }[] }).options[0]!.value;
    const r = parseSection(
      section('design'),
      form({
        q_design_style_cards: [style],
        q_reference_sites_url_0: 'https://example.com',
        q_reference_sites_note_0: ' clean ',
        q_reference_sites_url_1: '',
        q_logo_none: 'on',
      }),
    );
    expect(r.problems).toEqual([]);
    expect(r.answers.design_style_cards).toEqual([style]);
    expect(r.answers.reference_sites).toEqual([{ url: 'https://example.com', note: 'clean' }]);
    expect(r.answers.logo).toEqual({ none: true });
  });

  it('drops a link note where the question does not ask for notes', () => {
    const plain = {
      id: 'plain',
      title: 'Plain',
      questions: [
        {
          id: 'sites',
          type: 'links',
          label: 'Sites',
          required: false,
          max_links: 3,
          note_per_link: false,
        },
      ],
    } as unknown as (typeof sections)[number];
    const r = parseSection(
      plain,
      form({ q_sites_url_0: 'https://example.com', q_sites_note_0: 'ignored' }),
    );
    expect(r.answers.sites).toEqual([{ url: 'https://example.com' }]);
  });

  it('reports a bad answer and saves nothing for that question', () => {
    const r = parseSection(
      section('design'),
      form({ q_reference_sites_url_0: 'javascript:alert(1)' }),
    );
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toMatchObject({ id: 'reference_sites' });
    expect('reference_sites' in r.answers).toBe(false);
  });

  it('ignores fields from questions outside the section', () => {
    const r = parseSection(section('business'), form({ q_site_goal: 'x' }));
    expect('site_goal' in r.answers).toBe(false);
  });
});

describe('checkUpload', () => {
  const logo = q('logo');
  it('accepts a listed type and names it by extension, not by the browser type', () => {
    const r = checkUpload(logo, { name: 'My Logo.PNG', size: 1000 }, 0);
    expect(r).toEqual({ ok: true, mime: 'image/png', safeName: 'My_Logo.PNG' });
  });

  it('rejects zip, executables and macro documents', () => {
    for (const n of ['a.zip', 'a.exe', 'a.docm', 'a.xlsm', 'noextension'])
      expect(checkUpload(logo, { name: n, size: 1000 }, 0).ok).toBe(false);
  });

  it('rejects a type this question does not accept', () => {
    const r = checkUpload(logo, { name: 'clip.mp4', size: 1000 }, 0);
    expect(r.ok).toBe(false);
  });

  it('rejects an empty file, too many files and an oversized file', () => {
    expect(checkUpload(logo, { name: 'a.png', size: 0 }, 0).ok).toBe(false);
    expect(checkUpload(logo, { name: 'a.png', size: 10 }, 1).ok).toBe(false);
    expect(
      checkUpload(q('existing_copy_files'), { name: 'a.pdf', size: 26 * 1024 * 1024 }, 0).ok,
    ).toBe(false);
  });

  it('limits images to 5 MB even where the question allows more', () => {
    const r = checkUpload(logo, { name: 'a.png', size: 6 * 1024 * 1024 }, 0);
    expect(r).toEqual({ ok: false, message: expect.stringMatching(/5 MB/) });
    expect(
      checkUpload(q('existing_copy_files'), { name: 'a.pdf', size: 20 * 1024 * 1024 }, 0).ok,
    ).toBe(true);
  });

  it('refuses a question that is not a file question', () => {
    expect(checkUpload(q('business_name'), { name: 'a.png', size: 10 }, 0).ok).toBe(false);
  });
});

describe('safeFileName', () => {
  it('cannot climb out of its folder', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('..\\..\\x.png')).toBe('x.png');
    expect(safeFileName('.hidden')).toBe('hidden');
    expect(safeFileName('a b/c d.png')).toBe('c_d.png');
  });
});
