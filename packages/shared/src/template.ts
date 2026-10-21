// Intake template schema (P2-T01). A template is JSON: sections of questions, versioned per industry.
// Validation returns plain-language errors with the path of the offending field, so the console
// can show them to the owner as they edit (P2-T02 at go-live adds the editor).
import { z } from 'zod';

// Allowed upload types (docs/spec/04-intake.md) and the size cap (25 MB).
export const UPLOAD_TYPES = [
  'png',
  'jpeg',
  'webp',
  'svg',
  'pdf',
  'docx',
  'txt',
  'md',
  'json',
  'mp4',
] as const;
export const MAX_UPLOAD_MB = 25;

const id = z
  .string()
  .regex(
    /^[a-z][a-z0-9_]*$/,
    'use lowercase letters, digits and underscores, starting with a letter',
  );
const text = (what: string) => z.string().trim().min(1, `${what} cannot be empty`);

const base = {
  id,
  label: text('the question text'),
  help: z.string().trim().min(1).optional(),
  // Set explicitly by the owner for every question; there is no default.
  required: z.boolean({ error: 'required must be true or false' }),
};

const option = z.object({ value: id, label: text('an option label') }).strict();
const options = z
  .array(option)
  .min(2, 'needs at least 2 options')
  .refine((o) => new Set(o.map((x) => x.value)).size === o.length, 'option values must be unique');

const shortText = z.object({ ...base, type: z.literal('short_text') }).strict();
const longText = z.object({ ...base, type: z.literal('long_text') }).strict();
const singleChoice = z.object({ ...base, type: z.literal('single_choice'), options }).strict();
const multipleChoice = z
  .object({
    ...base,
    type: z.literal('multiple_choice'),
    options,
    max_selections: z.number().int().min(1, 'max_selections must be at least 1').optional(),
  })
  .strict();
const fileUpload = z
  .object({
    ...base,
    type: z.literal('file_upload'),
    accept: z
      .array(z.enum(UPLOAD_TYPES, { error: `accept may only list: ${UPLOAD_TYPES.join(', ')}` }))
      .min(1, 'accept needs at least one file type'),
    max_files: z.number().int().min(1).max(10).default(1),
    max_mb: z
      .number()
      .positive()
      .max(MAX_UPLOAD_MB, `max_mb cannot exceed ${MAX_UPLOAD_MB}`)
      .default(MAX_UPLOAD_MB),
    // When true, "I have none" is an explicit answer that satisfies a required question.
    none_allowed: z.boolean().default(false),
  })
  .strict();
const links = z
  .object({
    ...base,
    type: z.literal('links'),
    max_links: z.number().int().min(1).max(10).default(5),
    // Ask what the client likes about each link (used for reference sites).
    note_per_link: z.boolean().default(false),
  })
  .strict();

export const questionSchema = z
  .discriminatedUnion('type', [
    shortText,
    longText,
    singleChoice,
    multipleChoice,
    fileUpload,
    links,
  ])
  .superRefine((q, ctx) => {
    if (q.type === 'multiple_choice' && q.max_selections !== undefined) {
      if (q.max_selections > q.options.length)
        ctx.addIssue({
          code: 'custom',
          path: ['max_selections'],
          message: `max_selections (${q.max_selections}) is more than the number of options (${q.options.length})`,
        });
    }
  });

const section = z
  .object({
    id,
    title: text('the section title'),
    description: z.string().trim().min(1).optional(),
    questions: z.array(questionSchema).min(1, 'a section needs at least one question'),
  })
  .strict();

export const templateSchema = z
  .object({
    industry: z
      .string()
      .regex(
        /^[a-z][a-z0-9-]*$/,
        'use lowercase letters, digits and hyphens, e.g. "generic" or "dental"',
      ),
    version: z.number().int().min(1, 'version starts at 1'),
    sections: z.array(section).min(1, 'a template needs at least one section'),
  })
  .strict()
  .superRefine((t, ctx) => {
    const sectionIds = new Set<string>();
    const questionIds = new Map<string, string>();
    t.sections.forEach((s, si) => {
      if (sectionIds.has(s.id))
        ctx.addIssue({
          code: 'custom',
          path: ['sections', si, 'id'],
          message: `section id "${s.id}" is used twice`,
        });
      sectionIds.add(s.id);
      s.questions.forEach((q, qi) => {
        // Answers are stored by question id for the whole project, so ids are unique across sections.
        const first = questionIds.get(q.id);
        if (first)
          ctx.addIssue({
            code: 'custom',
            path: ['sections', si, 'questions', qi, 'id'],
            message: `question id "${q.id}" is already used in section "${first}"`,
          });
        questionIds.set(q.id, s.id);
      });
    });
  });

export type IntakeTemplate = z.infer<typeof templateSchema>;
export type TemplateQuestion = z.infer<typeof questionSchema>;

export type TemplateCheck =
  { ok: true; template: IntakeTemplate } | { ok: false; errors: string[] };

// "sections[1].questions[0].options" style path, with the human title of the section where known.
function pathText(path: PropertyKey[]): string {
  return (
    path
      .map((p, i) => (typeof p === 'number' ? `[${p + 1}]` : i === 0 ? String(p) : `.${String(p)}`))
      .join('') || 'template'
  );
}

export function validateTemplate(input: unknown): TemplateCheck {
  const r = templateSchema.safeParse(input);
  if (r.success) return { ok: true, template: r.data };
  return {
    ok: false,
    errors: r.error.issues.map((i) => `${pathText(i.path)}: ${i.message}`),
  };
}

// Question ids in order, for the answer table (intake_responses.question_id).
export function questionIds(t: IntakeTemplate): string[] {
  return t.sections.flatMap((s) => s.questions.map((q) => q.id));
}
