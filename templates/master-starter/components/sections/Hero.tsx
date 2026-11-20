import Link from 'next/link';
import type { ReactNode } from 'react';

export function Hero({
  title,
  children,
  cta,
  ctaHref,
}: {
  title: string;
  children?: ReactNode;
  cta?: string;
  ctaHref?: string;
}) {
  return (
    <section className="fade-in mx-auto max-w-5xl px-4 py-16 sm:py-24">
      <h1 className="text-4xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-5xl">
        {title}
      </h1>
      {children ? (
        <div className="mt-4 max-w-2xl text-lg text-[var(--color-muted)]">{children}</div>
      ) : null}
      {cta && ctaHref ? (
        <Link href={ctaHref} className="btn mt-8 inline-block">
          {cta}
        </Link>
      ) : null}
    </section>
  );
}
