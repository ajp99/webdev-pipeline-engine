// SEO basics (P3-T02): per-page metadata with Open Graph and Twitter tags, and JSON-LD for the business,
// generated from content/settings.json, never typed by hand.
import type { Metadata } from 'next';
import type { Settings } from './schemas';

export function pageMetadata(
  s: Settings,
  page: { title: string; description: string; path: string },
): Metadata {
  const url = `${s.url}${page.path === '/' ? '' : page.path}`;
  const title =
    page.path === '/' ? `${s.businessName}: ${page.title}` : `${page.title} | ${s.businessName}`;
  return {
    metadataBase: new URL(s.url),
    title,
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: page.description,
      url,
      siteName: s.businessName,
      locale: s.locale.replace('-', '_'),
      type: 'website',
      images: [{ url: s.shareImage, width: 1200, height: 630, alt: s.businessName }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: page.description,
      images: [s.shareImage],
    },
  };
}

/** Organization or LocalBusiness (or the subtype the settings name) as JSON-LD. */
export function businessJsonLd(s: Settings): Record<string, unknown> {
  const c = s.contact;
  const local = s.schemaType !== 'Organization';
  return {
    '@context': 'https://schema.org',
    '@type': s.schemaType,
    name: s.businessName,
    description: s.description,
    url: s.url,
    ...(s.logo ? { logo: `${s.url}${s.logo.src}` } : {}),
    image: `${s.url}${s.shareImage}`,
    ...(c.email ? { email: c.email } : {}),
    ...(c.phone ? { telephone: c.phone } : {}),
    ...(local && c.address
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: c.address.street,
            addressLocality: c.address.city,
            postalCode: c.address.postalCode,
            addressCountry: c.address.country,
          },
        }
      : {}),
    ...(local && c.openingHours.length ? { openingHours: c.openingHours } : {}),
    ...(s.social.length ? { sameAs: s.social.map((x) => x.url) } : {}),
  };
}

/** JSON for a <script> tag: "<" is escaped so content can never close the tag. */
export const jsonLdText = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
