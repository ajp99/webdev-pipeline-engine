'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The contact form (P3-T02). Spam protection on every form: a hidden honeypot field, the time the form was
 * opened (too-fast submits are dropped), and a best-effort rate limit on the server. Cloudflare Turnstile is
 * added only when the PRD asks (settings.contactForm.turnstileSiteKey). On failure the visitor sees the phone
 * number and plain contact links.
 */
export function ContactForm({
  phone,
  email,
  turnstileSiteKey = null,
}: {
  phone: string | null;
  email: string | null;
  turnstileSiteKey?: string | null;
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const opened = useRef(0);
  useEffect(() => {
    opened.current = Date.now();
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('sending');
    setError(null);
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...data, openedAt: opened.current }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && body.ok) return setState('sent');
      if (res.status === 400 && body.error) {
        setError(body.error);
        return setState('idle');
      }
      setState('failed');
    } catch {
      setState('failed');
    }
  }

  if (state === 'sent')
    return (
      <p role="status" className="rounded-lg bg-[var(--color-surface)] p-5 text-[var(--color-ink)]">
        Thank you. Your message has been sent and we will reply soon.
      </p>
    );
  if (state === 'failed')
    return (
      <div
        role="alert"
        className="rounded-lg bg-[var(--color-surface)] p-5 text-[var(--color-ink)]"
      >
        <p className="font-semibold">Sorry, the message could not be sent.</p>
        <p className="mt-2">Please contact us directly:</p>
        <ul className="mt-2 space-y-1">
          {phone ? (
            <li>
              Phone: <a href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a>
            </li>
          ) : null}
          {email ? (
            <li>
              Email: <a href={`mailto:${email}`}>{email}</a>
            </li>
          ) : null}
        </ul>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate={false}>
      {error ? (
        <p role="alert" className="text-[var(--color-error)]">
          {error}
        </p>
      ) : null}
      <div>
        <label htmlFor="cf-name" className="block font-medium text-[var(--color-ink)]">
          Name
        </label>
        <input
          id="cf-name"
          name="name"
          required
          maxLength={120}
          autoComplete="name"
          className="field"
        />
      </div>
      <div>
        <label htmlFor="cf-email" className="block font-medium text-[var(--color-ink)]">
          Email
        </label>
        <input
          id="cf-email"
          name="email"
          type="email"
          required
          maxLength={200}
          autoComplete="email"
          className="field"
        />
      </div>
      <div>
        <label htmlFor="cf-message" className="block font-medium text-[var(--color-ink)]">
          Message
        </label>
        <textarea
          id="cf-message"
          name="message"
          required
          maxLength={5000}
          rows={5}
          className="field"
        />
      </div>
      {/* Honeypot: hidden from people and assistive technology; bots fill it in. */}
      <div aria-hidden="true" className="hp">
        <label htmlFor="cf-website">Website</label>
        <input id="cf-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {turnstileSiteKey ? (
        <>
          <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <div className="cf-turnstile" data-sitekey={turnstileSiteKey} />
        </>
      ) : null}
      <button type="submit" disabled={state === 'sending'} className="btn">
        {state === 'sending' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
