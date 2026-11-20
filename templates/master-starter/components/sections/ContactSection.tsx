import { getSettings } from '@/lib/content';
import { ContactForm } from '../ContactForm';

/** The contact details and, when the settings enable it, the form. */
export function ContactSection({ title = 'Get in touch' }: { title?: string }) {
  const s = getSettings();
  const c = s.contact;
  return (
    <section className="mx-auto grid max-w-5xl gap-10 px-4 py-12 md:grid-cols-2">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--color-ink)]">{title}</h2>
        <ul className="mt-4 space-y-2 text-[var(--color-muted)]">
          {c.phone ? (
            <li>
              Phone: <a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a>
            </li>
          ) : null}
          {c.email ? (
            <li>
              Email: <a href={`mailto:${c.email}`}>{c.email}</a>
            </li>
          ) : null}
          {c.address ? (
            <li>
              {c.address.street}, {c.address.city} {c.address.postalCode}
            </li>
          ) : null}
          {c.openingHours.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </div>
      {s.contactForm.enabled ? (
        <ContactForm
          phone={c.phone}
          email={c.email}
          turnstileSiteKey={s.contactForm.turnstileSiteKey}
        />
      ) : null}
    </section>
  );
}
