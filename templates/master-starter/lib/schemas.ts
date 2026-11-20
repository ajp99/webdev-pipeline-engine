// The content schemas (P3-T02). Settings, navigation and every page and post are checked at build, and a problem
// is reported in plain words with the file and the field, so the client (or an agent) knows what to fix.
import { z } from 'zod';

const text = (what: string, max = 300) =>
  z
    .string({ error: `${what} must be text` })
    .trim()
    .min(1, `${what} is empty`)
    .max(max, `${what} is longer than ${max} characters`);
const href = z
  .string({ error: 'a link must be text' })
  .regex(
    /^(\/[a-z0-9\-/]*|https:\/\/\S+|mailto:\S+|tel:\S+)$/,
    'a link must start with /, https://, mailto: or tel:',
  );

export const SCHEMA_TYPES = [
  'Organization',
  'LocalBusiness',
  'Dentist',
  'LegalService',
  'Restaurant',
  'ProfessionalService',
  'Store',
] as const;

export const settingsSchema = z.object({
  businessName: text('the business name', 120),
  tagline: text('the tagline', 160),
  description: text('the description', 300),
  url: z
    .string()
    .regex(
      /^https:\/\/[^\s/]+$/,
      'url must be the site address, like https://www.example.com, without a trailing slash',
    ),
  locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'locale must look like en or en-GB'),
  schemaType: z.enum(SCHEMA_TYPES, {
    error: `schemaType must be one of ${SCHEMA_TYPES.join(', ')}`,
  }),
  contact: z.object({
    email: z.email('contact.email must be an email address').nullable(),
    phone: text('contact.phone', 40).nullable(),
    address: z
      .object({
        street: text('the street'),
        city: text('the city'),
        postalCode: text('the postal code', 20),
        country: z.string().regex(/^[A-Z]{2}$/, 'the country must be a two-letter code like GB'),
      })
      .nullable(),
    openingHours: z.array(text('an opening-hours line', 60)).max(14),
  }),
  logo: z
    .object({
      src: z.string().startsWith('/', 'the logo src must start with /'),
      alt: text('the logo alt text', 120),
    })
    .nullable(),
  shareImage: z.string().startsWith('/', 'shareImage must start with /'),
  social: z
    .array(
      z.object({
        label: text('a social label', 40),
        url: z.url({ protocol: /^https$/, error: 'a social url must start with https://' }),
      }),
    )
    .max(10),
  contactForm: z.object({ enabled: z.boolean(), turnstileSiteKey: z.string().min(1).nullable() }),
});
export type Settings = z.infer<typeof settingsSchema>;

const link = z.object({ label: text('a menu label', 40), href });
export const navigationSchema = z.object({
  main: z.array(link).max(8),
  footer: z.array(link).max(12),
});
export type Navigation = z.infer<typeof navigationSchema>;

export const pageFrontMatter = z.object({
  title: text('title', 60),
  description: text('description', 155),
});
export const postFrontMatter = pageFrontMatter.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must look like 2026-01-31'),
  author: text('author', 80),
  categories: z
    .array(z.string().regex(/^[a-z0-9-]+$/, 'a category must be lower-case words joined by -'))
    .max(5)
    .default([]),
  draft: z.boolean().default(false),
});
export type PageMeta = z.infer<typeof pageFrontMatter>;
export type PostMeta = z.infer<typeof postFrontMatter>;

/** A schema problem in plain words: "content/settings.json: contact.email: contact.email must be an email address". */
export function describe(file: string, error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((i) => `${file}: ${i.path.length ? `${i.path.join('.')}: ` : ''}${i.message}`)
    .join('\n');
}

export class ContentError extends Error {
  constructor(message: string) {
    super(`The site content has a problem:\n${message}`);
    this.name = 'ContentError';
  }
}
