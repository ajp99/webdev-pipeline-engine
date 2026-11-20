import { describe, expect, it, vi } from 'vitest';
import { handleContact, MIN_FILL_MS, rateLimiter, type ContactConfig } from '../lib/contact';
import { stubOutbox, stubTransport, transportFromEnv } from '../lib/mail';

const NOW = 1_000_000;
const cfg = (over: Partial<ContactConfig> = {}): ContactConfig => ({
  to: 'owner@example.com',
  from: 'site@example.com',
  businessName: 'Example',
  transport: stubTransport,
  now: () => NOW,
  ...over,
});
const form = (over: Record<string, unknown> = {}) => ({
  name: 'Ann',
  email: 'ann@example.org',
  message: 'Hello there',
  website: '',
  openedAt: NOW - 10_000,
  ...over,
});
const always = () => true;

describe('the contact form route logic', () => {
  it('sends a valid message with the visitor as reply-to', async () => {
    stubOutbox.length = 0;
    expect(await handleContact(form(), '1.2.3.4', always, cfg())).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(stubOutbox[0]).toMatchObject({
      to: 'owner@example.com',
      replyTo: 'ann@example.org',
      subject: 'New message from the Example website',
    });
  });
  it('drops a filled honeypot and a too-fast submit quietly', async () => {
    stubOutbox.length = 0;
    expect(
      (await handleContact(form({ website: 'spam.example' }), 'ip', always, cfg())).body,
    ).toEqual({ ok: true });
    expect(
      (await handleContact(form({ openedAt: NOW - MIN_FILL_MS + 1 }), 'ip', always, cfg())).body,
    ).toEqual({ ok: true });
    expect((await handleContact(form({ openedAt: undefined }), 'ip', always, cfg())).body).toEqual({
      ok: true,
    });
    expect(stubOutbox).toHaveLength(0);
  });
  it('says what is wrong with a field', async () => {
    expect(await handleContact(form({ email: 'nope' }), 'ip', always, cfg())).toEqual({
      status: 400,
      body: { ok: false, error: 'Please enter a valid email address.' },
    });
    expect((await handleContact(form({ message: ' ' }), 'ip', always, cfg())).body.error).toBe(
      'Please write a message.',
    );
  });
  it('limits each address to 5 messages in 10 minutes (best effort)', async () => {
    const allow = rateLimiter();
    for (let i = 0; i < 5; i++) expect(allow('a', NOW + i)).toBe(true);
    expect(allow('a', NOW + 10)).toBe(false);
    expect(allow('b', NOW + 10)).toBe(true);
    expect(allow('a', NOW + 10 * 60 * 1000 + 1)).toBe(true);
    expect((await handleContact(form(), 'a', () => false, cfg())).status).toBe(429);
  });
  it('reports a transport failure so the visitor sees the phone number', async () => {
    const failing = { send: vi.fn(async () => Promise.reject(new Error('smtp down'))) };
    expect(await handleContact(form(), 'ip', always, cfg({ transport: failing }))).toEqual({
      status: 502,
      body: { ok: false, error: 'The message could not be sent.' },
    });
  });
  it('checks Turnstile only when the PRD asked for it', async () => {
    const verify = vi.fn(async () => false);
    expect(
      (await handleContact(form(), 'ip', always, cfg({ verifyTurnstile: verify }))).status,
    ).toBe(400);
    expect(verify).toHaveBeenCalledWith('', 'ip');
  });
});

describe('mail transports from the environment', () => {
  it('defaults to the stub and refuses an unknown one', () => {
    expect(transportFromEnv({})).toBe(stubTransport);
    expect(() => transportFromEnv({ MAIL_TRANSPORT: 'carrier-pigeon' })).toThrow('not known');
  });
  it('names a missing setting, never a secret value', () => {
    expect(() =>
      transportFromEnv({ MAIL_TRANSPORT: 'smtp', SMTP_HOST: 'h', SMTP_PASSWORD: 's3cret' }),
    ).toThrow('SMTP_USER is not set');
    try {
      transportFromEnv({ MAIL_TRANSPORT: 'smtp', SMTP_HOST: 'h', SMTP_PASSWORD: 's3cret' });
    } catch (e) {
      expect(String(e)).not.toContain('s3cret');
    }
  });
  it('signs in to Microsoft 365 with client credentials before sending', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({}), { status: 401 }));
    const t = transportFromEnv(
      {
        MAIL_TRANSPORT: 'microsoft365',
        M365_USER: 'u@x.com',
        M365_TENANT_ID: 't',
        M365_CLIENT_ID: 'c',
        M365_CLIENT_SECRET: 's',
      },
      fetchImpl as unknown as typeof fetch,
    );
    await expect(
      t.send({ to: 'a', from: 'b', replyTo: 'c', subject: 'd', text: 'e' }),
    ).rejects.toThrow('Microsoft 365 sign-in failed (401)');
    expect(String((fetchImpl.mock.calls[0] as unknown[])[0])).toContain(
      'login.microsoftonline.com/t/oauth2/v2.0/token',
    );
  });
});
