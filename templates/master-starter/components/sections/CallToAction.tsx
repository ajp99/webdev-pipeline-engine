import Link from 'next/link';

export function CallToAction({
  title,
  text,
  label,
  href,
}: {
  title: string;
  text?: string;
  label: string;
  href: string;
}) {
  return (
    <section className="mx-auto my-12 max-w-5xl rounded-xl bg-[var(--color-primary)] px-6 py-10 text-[var(--color-on-primary)]">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {text ? <p className="mt-2 max-w-2xl opacity-90">{text}</p> : null}
      <Link href={href} className="btn-inverse mt-6 inline-block">
        {label}
      </Link>
    </section>
  );
}
