// The contact form's server logic (P3-T02), kept free of Next.js so it is tested directly. Spam protection on
// every form: the honeypot, a minimum time between opening and sending, and a best-effort rate limit per address.
// A dropped submission still answers "ok", so a bot learns nothing.
import { z } from 'zod';
import type { Transport } from './mail';

export const MIN_FILL_MS = 3000;
export const RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };

const submission = z.object({
  name: z.string().trim().min(1, 'Please enter your name.').max(120, 'Your name is too long.'),
  email: z.email('Please enter a valid email address.').max(200),
  message: z
    .string()
    .trim()
    .min(1, 'Please write a message.')
    .max(5000, 'The message is too long (5000 characters at most).'),
  website: z.string().optional(),
  openedAt: z.number().optional(),
  'cf-turnstile-response': z.string().optional(),
});

export type ContactConfig = {
  to: string;
  from: string;
  businessName: string;
  transport: Transport;
  /** Set when the PRD asked for Turnstile: checks the token with Cloudflare. */
  verifyTurnstile?: (token: string, ip: string) => Promise<boolean>;
  now?: () => number;
};

export type ContactResult = {
  status: 200 | 400 | 429 | 502;
  body: { ok: boolean; error?: string };
};

/**
 * The visitor's address for the rate limit. Vercel sets x-real-ip and x-vercel-forwarded-for itself, so a
 * visitor cannot choose them; elsewhere only the last x-forwarded-for entry (added by the nearest proxy) is
 * trusted, never the first, which the visitor can write.
 */
export function clientIp(headers: Headers): string {
  const own = headers.get('x-vercel-forwarded-for') ?? headers.get('x-real-ip');
  if (own?.trim()) return own.split(',')[0]!.trim();
  const hops = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  return hops.at(-1) ?? 'unknown';
}

/**
 * Best-effort, in memory: resets when the server restarts, and each server instance counts on its own. At most
 * `maxKeys` addresses are kept: past that, expired ones are dropped first, then the oldest.
 */
export function rateLimiter(
  max = RATE_LIMIT.max,
  windowMs = RATE_LIMIT.windowMs,
  maxKeys = 10_000,
) {
  const hits = new Map<string, number[]>();
  return (key: string, now: number): boolean => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    hits.delete(key);
    if (hits.size >= maxKeys) {
      for (const [k, ts] of hits) if (!ts.some((t) => now - t < windowMs)) hits.delete(k);
      while (hits.size >= maxKeys) hits.delete(hits.keys().next().value!);
    }
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    hits.set(key, [...recent, now]);
    return true;
  };
}

export async function handleContact(
  raw: unknown,
  ip: string,
  allow: (key: string, now: number) => boolean,
  cfg: ContactConfig,
): Promise<ContactResult> {
  const now = (cfg.now ?? Date.now)();
  if (!allow(ip, now))
    return {
      status: 429,
      body: { ok: false, error: 'Too many messages. Please try again later.' },
    };
  const r = submission.safeParse(raw);
  if (!r.success) return { status: 400, body: { ok: false, error: r.error.issues[0]!.message } };
  const s = r.data;
  // Honeypot filled, or sent faster than a person can type: drop it quietly. openedAt comes from the browser,
  // so a bot can fake it: this stops only the simplest scripts (best effort, like the rate limit).
  if (s.website) return { status: 200, body: { ok: true } };
  if (!s.openedAt || now - s.openedAt < MIN_FILL_MS) return { status: 200, body: { ok: true } };
  if (cfg.verifyTurnstile && !(await cfg.verifyTurnstile(s['cf-turnstile-response'] ?? '', ip)))
    return { status: 400, body: { ok: false, error: 'Please complete the check and send again.' } };
  try {
    await cfg.transport.send({
      to: cfg.to,
      from: cfg.from,
      replyTo: s.email,
      subject: `New message from the ${cfg.businessName} website`,
      text: `Name: ${s.name}\nEmail: ${s.email}\n\n${s.message}`,
    });
  } catch {
    return { status: 502, body: { ok: false, error: 'The message could not be sent.' } };
  }
  return { status: 200, body: { ok: true } };
}
