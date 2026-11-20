import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-24">
      <h1 className="text-3xl font-semibold text-[var(--color-ink)]">Page not found</h1>
      <p className="mt-3 text-[var(--color-muted)]">
        The page you were looking for is not here. <Link href="/">Go to the home page</Link>.
      </p>
    </section>
  );
}
