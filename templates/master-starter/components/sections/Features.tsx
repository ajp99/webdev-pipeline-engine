export type Feature = { title: string; text: string };

export function Features({ title, items }: { title?: string; items: Feature[] }) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      {title ? <h2 className="text-2xl font-semibold text-[var(--color-ink)]">{title}</h2> : null}
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((f) => (
          <li key={f.title} className="rounded-lg bg-[var(--color-surface)] p-5">
            <h3 className="font-semibold text-[var(--color-ink)]">{f.title}</h3>
            <p className="mt-2 text-[var(--color-muted)]">{f.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
