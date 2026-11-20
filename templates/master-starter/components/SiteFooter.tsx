import Link from 'next/link';
import type { Navigation, Settings } from '@/lib/schemas';

export function SiteFooter({ settings, nav }: { settings: Settings; nav: Navigation }) {
  return (
    <footer className="mt-16 border-t border-[var(--color-line)]">
      <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-4 px-4 py-8 text-sm text-[var(--color-muted)]">
        <p>
          © {new Date().getFullYear()} {settings.businessName}
        </p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-4">
            {nav.footer.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
            {settings.social.map((s) => (
              <li key={s.url}>
                <a href={s.url} rel="noopener">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
