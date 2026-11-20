import Image from 'next/image';
import Link from 'next/link';
import type { Navigation, Settings } from '@/lib/schemas';

export function SiteHeader({ settings, nav }: { settings: Settings; nav: Navigation }) {
  return (
    <header className="border-b border-[var(--color-line)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="font-semibold text-[var(--color-ink)]">
          {settings.logo ? (
            <Image
              src={settings.logo.src}
              alt={settings.logo.alt}
              width={160}
              height={40}
              priority
            />
          ) : (
            settings.businessName
          )}
        </Link>
        <nav aria-label="Main">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {nav.main.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-[var(--color-ink)] hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
