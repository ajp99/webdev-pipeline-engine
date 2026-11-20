// Checks every content file against its schema and prints the problems in plain words (P3-T02).
// Run with: pnpm check:content. The build runs the same checks.
import { getNavigation, getPages, getPosts, getSettings } from '../lib/content';

try {
  getSettings();
  getNavigation();
  const pages = getPages();
  const posts = getPosts(true);
  if (!pages.some((p) => p.slug === 'home'))
    throw new Error('content/pages/home.mdx is missing: the site needs a home page');
  console.log(`Content is fine: ${pages.length} pages, ${posts.length} posts.`);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
