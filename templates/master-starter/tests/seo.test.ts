import { describe, expect, it } from 'vitest';
import type { Settings } from '../lib/schemas';
import { businessJsonLd, jsonLdText, pageMetadata } from '../lib/seo';

const settings: Settings = {
  businessName: 'Example Dental',
  tagline: 't',
  description: 'd',
  url: 'https://www.example.com',
  locale: 'en-GB',
  schemaType: 'Dentist',
  contact: {
    email: 'hi@example.com',
    phone: '+44 1',
    address: { street: '1 St', city: 'Town', postalCode: 'AB1', country: 'GB' },
    openingHours: ['Mo-Fr 09:00-17:00'],
  },
  logo: null,
  shareImage: '/share.png',
  social: [{ label: 'Instagram', url: 'https://instagram.com/example' }],
  contactForm: { enabled: true, turnstileSiteKey: null },
};

describe('SEO basics', () => {
  it('builds the business JSON-LD from the settings', () => {
    expect(businessJsonLd(settings)).toMatchObject({
      '@type': 'Dentist',
      name: 'Example Dental',
      telephone: '+44 1',
      address: { '@type': 'PostalAddress', addressLocality: 'Town', addressCountry: 'GB' },
      openingHours: ['Mo-Fr 09:00-17:00'],
      sameAs: ['https://instagram.com/example'],
    });
    const org = businessJsonLd({ ...settings, schemaType: 'Organization' });
    expect(org).not.toHaveProperty('address');
  });
  it('escapes < so JSON-LD cannot close its script tag', () => {
    expect(jsonLdText({ name: '</script><script>alert(1)</script>' })).not.toContain('</script>');
  });
  it('gives every page a title, canonical URL, Open Graph and Twitter tags', () => {
    const m = pageMetadata(settings, { title: 'About', description: 'Who we are', path: '/about' });
    expect(m.title).toBe('About | Example Dental');
    expect(m.alternates?.canonical).toBe('https://www.example.com/about');
    expect(m.openGraph).toMatchObject({ locale: 'en_GB', url: 'https://www.example.com/about' });
    expect(m.twitter).toMatchObject({ card: 'summary_large_image' });
  });
});
