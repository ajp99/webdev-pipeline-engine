import type { MetadataRoute } from 'next';
import { getSettings } from '@/lib/content';

export default function robots(): MetadataRoute.Robots {
  const { url } = getSettings();
  return { rules: { userAgent: '*', allow: '/' }, sitemap: `${url}/sitemap.xml` };
}
