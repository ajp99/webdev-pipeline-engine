import type { MetadataRoute } from 'next';
import { getPages, getPosts, getSettings } from '@/lib/content';

export default function sitemap(): MetadataRoute.Sitemap {
  const { url } = getSettings();
  const pages = getPages().map((p) => `${url}${p.slug === 'home' ? '' : `/${p.slug}`}`);
  const posts = getPosts();
  return [
    ...pages.map((u) => ({ url: u })),
    ...(posts.length ? [{ url: `${url}/blog` }] : []),
    ...posts.map((p) => ({ url: `${url}/blog/${p.slug}`, lastModified: p.meta.date })),
  ];
}
