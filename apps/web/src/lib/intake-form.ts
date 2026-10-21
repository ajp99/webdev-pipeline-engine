// Turns a posted intake section into answers, and checks a file before it is stored (P2-T03).
// Pure functions, so the console's server actions stay thin and these rules are tested alone.
import {
  answerProblem,
  type Answers,
  type IntakeTemplate,
  type LinkAnswer,
  type TemplateQuestion,
} from '@wpe/shared';

type Section = IntakeTemplate['sections'][number];

export type FormFields = {
  get(name: string): string | null;
  getAll(name: string): string[];
};

export type FieldProblem = { id: string; label: string; message: string };

/** Field names used by the form: q_<id>, q_<id>_url_<n>, q_<id>_note_<n>, q_<id>_none. */
export const field = (id: string) => `q_${id}`;
export const linkUrlField = (id: string, n: number) => `q_${id}_url_${n}`;
export const linkNoteField = (id: string, n: number) => `q_${id}_note_${n}`;
export const noneField = (id: string) => `q_${id}_none`;

function read(q: TemplateQuestion, f: FormFields): unknown {
  switch (q.type) {
    case 'short_text':
    case 'long_text': {
      const v = (f.get(field(q.id)) ?? '').trim();
      return v === '' ? null : v;
    }
    case 'single_choice': {
      const v = f.get(field(q.id)) ?? '';
      return v === '' ? null : v;
    }
    case 'multiple_choice': {
      const v = f.getAll(field(q.id));
      return v.length === 0 ? null : v;
    }
    case 'links': {
      const out: LinkAnswer[] = [];
      for (let n = 0; n < q.max_links; n++) {
        const url = (f.get(linkUrlField(q.id, n)) ?? '').trim();
        if (url === '') continue;
        const note = (f.get(linkNoteField(q.id, n)) ?? '').trim();
        out.push(q.note_per_link && note !== '' ? { url, note } : { url });
      }
      return out.length === 0 ? null : out;
    }
    case 'file_upload':
      return f.get(noneField(q.id)) === 'on' ? { none: true } : null;
  }
}

/** Reads one section of the form. A problem in any answer means nothing from this section is saved. */
export function parseSection(
  section: Section,
  f: FormFields,
): { answers: Answers; problems: FieldProblem[] } {
  const answers: Answers = {};
  const problems: FieldProblem[] = [];
  for (const q of section.questions) {
    const value = read(q, f);
    const message = answerProblem(q, value);
    if (message) problems.push({ id: q.id, label: q.label, message });
    else answers[q.id] = value as Answers[string];
  }
  return { answers, problems };
}

// File types by extension. The browser's own type is not trusted.
const MIME_BY_EXT: Record<string, { type: string; ext: string }> = {
  png: { type: 'image/png', ext: 'png' },
  jpg: { type: 'image/jpeg', ext: 'jpeg' },
  jpeg: { type: 'image/jpeg', ext: 'jpeg' },
  webp: { type: 'image/webp', ext: 'webp' },
  svg: { type: 'image/svg+xml', ext: 'svg' },
  pdf: { type: 'application/pdf', ext: 'pdf' },
  docx: {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ext: 'docx',
  },
  txt: { type: 'text/plain', ext: 'txt' },
  md: { type: 'text/markdown', ext: 'md' },
  json: { type: 'application/json', ext: 'json' },
  mp4: { type: 'video/mp4', ext: 'mp4' },
};
const MB = 1024 * 1024;
export const IMAGE_MAX_BYTES = 5 * MB; // D-211

export type UploadCheck =
  { ok: true; mime: string; safeName: string } | { ok: false; message: string };

/** Safe object name: letters, digits, dot, dash and underscore only, so the path cannot escape its folder. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '');
  return (cleaned || 'file').slice(-100);
}

export function checkUpload(
  q: TemplateQuestion,
  file: { name: string; size: number },
  existingCount: number,
): UploadCheck {
  if (q.type !== 'file_upload') return { ok: false, message: 'this question does not take files' };
  const dot = file.name.lastIndexOf('.');
  const known = dot >= 0 ? MIME_BY_EXT[file.name.slice(dot + 1).toLowerCase()] : undefined;
  if (!known || !(q.accept as string[]).includes(known.ext))
    return { ok: false, message: `this question accepts only: ${q.accept.join(', ')}` };
  if (file.size <= 0) return { ok: false, message: 'the file is empty' };
  if (existingCount >= q.max_files)
    return {
      ok: false,
      message: `at most ${q.max_files} file${q.max_files === 1 ? '' : 's'} here`,
    };
  if (file.size > q.max_mb * MB) return { ok: false, message: `larger than ${q.max_mb} MB` };
  if (known.type.startsWith('image/') && file.size > IMAGE_MAX_BYTES)
    return { ok: false, message: 'images are limited to 5 MB' };
  return { ok: true, mime: known.type, safeName: safeFileName(file.name) };
}
