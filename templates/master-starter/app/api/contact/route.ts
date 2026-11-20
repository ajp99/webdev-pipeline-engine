import { settings } from '@/lib/settings-static';
import { clientIp, handleContact, rateLimiter } from '@/lib/contact';
import { transportFromEnv } from '@/lib/mail';

const allow = rateLimiter();

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  });
  return res.ok && ((await res.json()) as { success?: boolean }).success === true;
}

export async function POST(req: Request) {
  if (!settings.contactForm.enabled) return Response.json({ ok: false }, { status: 404 });
  const ip = clientIp(req.headers);
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'The form could not be read.' }, { status: 400 });
  }
  let transport;
  try {
    transport = transportFromEnv();
  } catch (e) {
    console.error(`contact form: ${e instanceof Error ? e.message : String(e)}`);
    return Response.json({ ok: false, error: 'The message could not be sent.' }, { status: 502 });
  }
  const result = await handleContact(raw, ip, allow, {
    to: process.env.MAIL_TO || settings.contact.email || '',
    from:
      process.env.MAIL_FROM ||
      process.env.SMTP_USER ||
      process.env.M365_USER ||
      'website@localhost',
    businessName: settings.businessName,
    transport,
    ...(settings.contactForm.turnstileSiteKey ? { verifyTurnstile } : {}),
  });
  return Response.json(result.body, { status: result.status });
}
