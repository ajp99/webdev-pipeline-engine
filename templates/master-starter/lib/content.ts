// Reads the site content from content/ (P3-T02): settings and navigation JSON, pages and blog posts in MDX.
// Server-only, at build time. Every file is checked against its schema; a problem stops the build with the file,
// the field and what is wrong.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ZodType } from 'zod';
import {
  ContentError,
  describe,
  navigationSchema,
  pageFrontMatter,
  postFrontMatter,
  settingsSchema,
  type Navigation,
  type PageMeta,
  type PostMeta,
  type Settings,
} from './schemas';

// Pages, posts and the sitemap are built at build time, so these reads never run on the deployed server; the
// tracing hint keeps the build from bundling the whole project. The contact route imports the settings
// statically instead (lib/settings-static.ts). CONTENT_DIR is only for the starter's own tests.
export const CONTENT_DIR =
  process.env.CONTENT_DIR ?? join(/*turbopackIgnore: true*/ process.cwd(), 'content');

function json<T>(file: string, schema: ZodType<T>): T {
  const path = join(/*turbopackIgnore: true*/ CONTENT_DIR, file);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new ContentError(
      `content/${file}: not valid JSON (${e instanceof Error ? e.message : String(e)})`,
    );
  }
  const r = schema.safeParse(raw);
  if (!r.success) throw new ContentError(describe(`content/${file}`, r.error));
  return r.data;
}

export const getSettings = (): Settings => json('settings.json', settingsSchema);
export const getNavigation = (): Navigation => json('navigation.json', navigationSchema);

/** Splits `---` front matter (simple YAML: strings, booleans, [lists]) from the MDX body. */
export function splitFrontMatter(
  file: string,
  text: string,
): { data: Record<string, unknown>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text.replace(/\r\n/g, '\n'));
  if (!m) throw new ContentError(`${file}: must start with front matter between --- lines`);
  const data: Record<string, unknown> = {};
  for (const line of m[1]!.split('\n')) {
    if (!line.trim()) continue;
    const i = line.indexOf(':');
    if (i < 0) throw new ContentError(`${file}: front-matter line "${line}" has no colon`);
    const key = line.slice(0, i).trim();
    let v: unknown = line.slice(i + 1).trim();
    const s = v as string;
    if (s === 'true' || s === 'false') v = s === 'true';
    else if (s.startsWith('[') && s.endsWith(']'))
      v = s
        .slice(1, -1)
        .split(',')
        .map((x) => x.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    else v = s.replace(/^["']|["']$/g, '');
    data[key] = v;
  }
  return { data, body: m[2]! };
}

function mdxFiles(dir: string): string[] {
  const path = join(/*turbopackIgnore: true*/ CONTENT_DIR, dir);
  return existsSync(path)
    ? readdirSync(path)
        .filter((f) => f.endsWith('.mdx'))
        .sort()
    : [];
}

export type Page = { slug: string; meta: PageMeta; body: string };
export type Post = { slug: string; meta: PostMeta; body: string };

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function getPages(): Page[] {
  return mdxFiles('pages').map((f) => {
    const slug = f.replace(/\.mdx$/, '');
    const file = `content/pages/${f}`;
    if (!SLUG.test(slug))
      throw new ContentError(`${file}: the file name must be lower-case words joined by -`);
    const { data, body } = splitFrontMatter(
      file,
      readFileSync(join(/*turbopackIgnore: true*/ CONTENT_DIR, 'pages', f), 'utf8'),
    );
    const r = pageFrontMatter.safeParse(data);
    if (!r.success) throw new ContentError(describe(file, r.error));
    return { slug, meta: r.data, body };
  });
}

export function getPage(slug: string): Page | undefined {
  return getPages().find((p) => p.slug === slug);
}

/** Blog posts, newest first. Drafts are left out of production builds. */
export function getPosts(includeDrafts = process.env.NODE_ENV !== 'production'): Post[] {
  return mdxFiles('posts')
    .map((f) => {
      const file = `content/posts/${f}`;
      const m = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.mdx$/.exec(f);
      if (!m)
        throw new ContentError(`${file}: the file name must look like 2026-01-31-my-post.mdx`);
      const { data, body } = splitFrontMatter(
        file,
        readFileSync(join(/*turbopackIgnore: true*/ CONTENT_DIR, 'posts', f), 'utf8'),
      );
      const r = postFrontMatter.safeParse(data);
      if (!r.success) throw new ContentError(describe(file, r.error));
      if (r.data.date !== m[1])
        throw new ContentError(`${file}: date ${r.data.date} does not match the file name`);
      return { slug: m[2]!, meta: r.data, body };
    })
    .filter((p) => includeDrafts || !p.meta.draft)
    .sort((a, b) => b.meta.date.localeCompare(a.meta.date));
}
