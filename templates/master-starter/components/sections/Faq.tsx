export type Question = { q: string; a: string };

/** Native details/summary: keyboard and screen-reader friendly with no script. */
export function Faq({ title = 'Questions', items }: { title?: string; items: Question[] }) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h2 className="text-2xl font-semibold text-[var(--color-ink)]">{title}</h2>
      <div className="mt-6 divide-y divide-[var(--color-line)]">
        {items.map((i) => (
          <details key={i.q} className="py-4">
            <summary className="cursor-pointer font-medium text-[var(--color-ink)]">{i.q}</summary>
            <p className="mt-2 text-[var(--color-muted)]">{i.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
