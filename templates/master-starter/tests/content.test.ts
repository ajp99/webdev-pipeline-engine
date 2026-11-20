import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Each test works on a copy of content/ so the starter's own files stay as they are.
async function load(change?: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'content-'));
  cpSync(join(__dirname, '../content'), dir, { recursive: true });
  change?.(dir);
  vi.resetModules();
  vi.stubEnv('CONTENT_DIR', dir);
  return { dir, c: await import('../lib/content') };
}
afterEach(() => vi.unstubAllEnvs());

describe('the starter content', () => {
  it('loads: settings, navigation, pages with a home page, and the sample post', async () => {
    const { c } = await load();
    expect(c.getSettings().businessName).toBe('Example Business');
    expect(c.getNavigation().footer.map((l) => l.href)).toEqual([
      '/privacy-policy',
      '/cookie-notice',
    ]);
    expect(c.getPages().map((p) => p.slug)).toEqual([
      'about',
      'contact',
      'cookie-notice',
      'home',
      'privacy-policy',
    ]);
    expect(c.getPosts(true)[0]!.meta.categories).toEqual(['news']);
  });
});

describe('schema problems are reported in plain words with the file and the field', () => {
  it('a bad email in the settings', async () => {
    const { c } = await load((d) => {
      const s = JSON.parse(readFileSync(join(d, 'settings.json'), 'utf8'));
      s.contact.email = 'not-an-email';
      writeFileSync(join(d, 'settings.json'), JSON.stringify(s));
    });
    expect(() => c.getSettings()).toThrow(
      'content/settings.json: contact.email: contact.email must be an email address',
    );
  });
  it('settings that are not JSON', async () => {
    const { c } = await load((d) => writeFileSync(join(d, 'settings.json'), '{ nope'));
    expect(() => c.getSettings()).toThrow('content/settings.json: not valid JSON');
  });
  it('a navigation link that is not a path or https', async () => {
    const { c } = await load((d) =>
      writeFileSync(
        join(d, 'navigation.json'),
        JSON.stringify({ main: [{ label: 'X', href: 'javascript:alert(1)' }], footer: [] }),
      ),
    );
    expect(() => c.getNavigation()).toThrow('main.0.href: a link must start with /');
  });
  it('a page title that is too long, and a page with no front matter', async () => {
    const { c } = await load((d) =>
      writeFileSync(
        join(d, 'pages', 'about.mdx'),
        `---\ntitle: ${'x'.repeat(61)}\ndescription: d\n---\nhi`,
      ),
    );
    expect(() => c.getPages()).toThrow(
      'content/pages/about.mdx: title: title is longer than 60 characters',
    );
    const second = await load((d) =>
      writeFileSync(join(d, 'pages', 'about.mdx'), 'no front matter'),
    );
    expect(() => second.c.getPages()).toThrow('must start with front matter');
  });
  it('a post whose date does not match its file name, and a bad file name', async () => {
    const { c } = await load((d) =>
      writeFileSync(
        join(d, 'posts', '2026-01-15-welcome-to-the-blog.mdx'),
        '---\ntitle: T\ndescription: D\ndate: 2026-02-01\nauthor: A\n---\nx',
      ),
    );
    expect(() => c.getPosts(true)).toThrow('does not match the file name');
    const bad = await load((d) =>
      writeFileSync(join(d, 'posts', 'Welcome.mdx'), '---\ntitle: T\n---\n'),
    );
    expect(() => bad.c.getPosts(true)).toThrow('must look like 2026-01-31-my-post.mdx');
  });
  it('drafts stay out of production, newest first', async () => {
    const { c, dir } = await load((d) =>
      writeFileSync(
        join(d, 'posts', '2026-03-01-later.mdx'),
        '---\ntitle: Later\ndescription: D\ndate: 2026-03-01\nauthor: A\ndraft: true\n---\nx',
      ),
    );
    expect(c.getPosts(true).map((p) => p.slug)).toEqual(['later', 'welcome-to-the-blog']);
    expect(c.getPosts(false).map((p) => p.slug)).toEqual(['welcome-to-the-blog']);
    rmSync(dir, { recursive: true });
  });
});
