import { notFound } from 'next/navigation';
import { Mdx } from '@/components/Mdx';
import { getPage, getSettings } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

// The home page is content/pages/home.mdx.
export function generateMetadata() {
  const page = getPage('home');
  return page ? pageMetadata(getSettings(), { ...page.meta, path: '/' }) : {};
}

export default function Home() {
  const page = getPage('home');
  if (!page) notFound();
  return <Mdx source={page.body} />;
}
