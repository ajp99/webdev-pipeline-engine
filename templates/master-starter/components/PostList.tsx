import Link from 'next/link';
import type { Post } from '@/lib/content';

export function PostList({ posts }: { posts: Post[] }) {
  if (posts.length === 0) return <p className="mt-6 text-[var(--color-muted)]">No posts yet.</p>;
  return (
    <ul className="mt-8 space-y-8">
      {posts.map((p) => (
        <li key={p.slug}>
          <h2 className="text-xl font-semibold">
            <Link href={`/blog/${p.slug}`} className="text-[var(--color-ink)] hover:underline">
              {p.meta.title}
            </Link>
          </h2>
          <p className="text-sm text-[var(--color-muted)]">
            <time dateTime={p.meta.date}>{p.meta.date}</time> · {p.meta.author}
          </p>
          <p className="mt-2 text-[var(--color-muted)]">{p.meta.description}</p>
        </li>
      ))}
    </ul>
  );
}
