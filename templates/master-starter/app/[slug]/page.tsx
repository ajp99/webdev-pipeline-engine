import { notFound } from 'next/navigation';
import { Mdx } from '@/components/Mdx';
import { getPage, getPages, getSettings } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

// Every other page in content/pages/ is built at build time; any other path is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return getPages()
    .filter((p) => p.slug !== 'home')
    .map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getPage(slug);
  return page ? pageMetadata(getSettings(), { ...page.meta, path: `/${slug}` }) : {};
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getPage(slug);
  if (!page || slug === 'home') notFound();
  return (
    <article className="prose-site mx-auto max-w-3xl px-4 py-12">
      <Mdx source={page.body} />
    </article>
  );
}
