import Link from 'next/link';
import { PostList } from '@/components/PostList';
import { getPosts, getSettings } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

export function generateMetadata() {
  return pageMetadata(getSettings(), {
    title: 'Blog',
    description: 'News and articles.',
    path: '/blog',
  });
}

export default function BlogIndex() {
  const posts = getPosts();
  const categories = [...new Set(posts.flatMap((p) => p.meta.categories))].sort();
  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-[var(--color-ink)]">Blog</h1>
      {categories.length ? (
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          Categories:{' '}
          {categories.map((c, i) => (
            <span key={c}>
              {i ? ', ' : ''}
              <Link href={`/blog/category/${c}`}>{c.replace(/-/g, ' ')}</Link>
            </span>
          ))}
        </p>
      ) : null}
      <PostList posts={posts} />
    </section>
  );
}
