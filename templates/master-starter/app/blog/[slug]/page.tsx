import { notFound } from 'next/navigation';
import { Mdx } from '@/components/Mdx';
import { getPosts, getSettings } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

export const dynamicParams = false;

export function generateStaticParams() {
  return getPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPosts().find((p) => p.slug === slug);
  return post ? pageMetadata(getSettings(), { ...post.meta, path: `/blog/${slug}` }) : {};
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPosts().find((p) => p.slug === slug);
  if (!post) notFound();
  return (
    <article className="prose-site mx-auto max-w-3xl px-4 py-12">
      <h1>{post.meta.title}</h1>
      <p className="text-sm text-[var(--color-muted)]">
        <time dateTime={post.meta.date}>{post.meta.date}</time> · {post.meta.author}
      </p>
      <Mdx source={post.body} />
    </article>
  );
}
