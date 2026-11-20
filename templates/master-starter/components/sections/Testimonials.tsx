/** Only real testimonials the client supplied; never invented (skill industry-copy/write-page-copy). */
export type Testimonial = { quote: string; name: string; role?: string };

export function Testimonials({ title, items }: { title?: string; items: Testimonial[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      {title ? <h2 className="text-2xl font-semibold text-[var(--color-ink)]">{title}</h2> : null}
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {items.map((t) => (
          <figure key={t.name} className="rounded-lg bg-[var(--color-surface)] p-5">
            <blockquote className="text-[var(--color-ink)]">“{t.quote}”</blockquote>
            <figcaption className="mt-3 text-sm text-[var(--color-muted)]">
              {t.name}
              {t.role ? `, ${t.role}` : ''}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
