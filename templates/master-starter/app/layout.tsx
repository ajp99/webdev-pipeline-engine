import type { ReactNode } from 'react';
import { JsonLd } from '@/components/JsonLd';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { getNavigation, getSettings } from '@/lib/content';
import { businessJsonLd } from '@/lib/seo';
import { bodyFont } from './fonts';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  const settings = getSettings();
  const nav = getNavigation();
  return (
    <html lang={settings.locale} className={bodyFont.variable}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader settings={settings} nav={nav} />
        <main id="main">{children}</main>
        <SiteFooter settings={settings} nav={nav} />
        <JsonLd data={businessJsonLd(settings)} />
      </body>
    </html>
  );
}
