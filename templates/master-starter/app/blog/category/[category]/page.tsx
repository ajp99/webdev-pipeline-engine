import { notFound } from 'next/navigation';
import { getPosts, getSettings } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';
import { PostList } from '@/components/PostList';

export const dynamicParams = false;

export function generateStaticParams() {
  return [...new Set(getPosts().flatMap((p) => p.meta.categories))].map((category) => ({
    category,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const name = category.replace(/-/g, ' ');
  return pageMetadata(getSettings(), {
    title: `Blog: ${name}`,
    description: `Posts about ${name}.`,
    path: `/blog/category/${category}`,
  });
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const posts = getPosts().filter((p) => p.meta.categories.includes(category));
  if (posts.length === 0) notFound();
  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-[var(--color-ink)]">
        Blog: {category.replace(/-/g, ' ')}
      </h1>
      <PostList posts={posts} />
    </section>
  );
}
