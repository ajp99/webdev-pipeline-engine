// Mail transports for the contact form (P3-T02). Settings come from environment variables only (never from
// content/ and never committed; see .env.example):
//   MAIL_TRANSPORT=smtp          generic SMTP, Google Workspace or a Gmail app password (smtp.gmail.com)
//   MAIL_TRANSPORT=microsoft365  Microsoft 365 with OAuth 2.0 (app-only, client credentials)
//   MAIL_TRANSPORT=stub          tests and local previews: messages are kept in memory, nothing is sent
//                                (refused when NODE_ENV=production unless MAIL_TRANSPORT_ALLOW_STUB=1)
import nodemailer from 'nodemailer';

export type Message = { to: string; from: string; replyTo: string; subject: string; text: string };
export interface Transport {
  send(m: Message): Promise<void>;
}

/** Messages the stub transport received (tests and local previews). */
export const stubOutbox: Message[] = [];
export const stubTransport: Transport = {
  async send(m) {
    stubOutbox.push(m);
  },
};

type Env = Record<string, string | undefined>;

function need(env: Env, name: string): string {
  const v = env[name]?.trim();
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

/** An access token for SMTP from Microsoft Entra ID (client credentials). */
async function microsoftToken(env: Env, fetchImpl: typeof fetch): Promise<string> {
  const tenant = need(env, 'M365_TENANT_ID');
  const res = await fetchImpl(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: need(env, 'M365_CLIENT_ID'),
        client_secret: need(env, 'M365_CLIENT_SECRET'),
        scope: 'https://outlook.office365.com/.default',
        grant_type: 'client_credentials',
      }),
    },
  );
  if (!res.ok) throw new Error(`Microsoft 365 sign-in failed (${res.status})`);
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error('Microsoft 365 sign-in returned no token');
  return body.access_token;
}

/** The transport the environment asks for. Errors name the missing setting, never a secret's value. */
export function transportFromEnv(
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Transport {
  const kind = env.MAIL_TRANSPORT?.trim() || 'stub';
  if (kind === 'stub') {
    // A live site must not drop enquiries silently: in production the stub needs MAIL_TRANSPORT_ALLOW_STUB=1.
    if (env.NODE_ENV === 'production' && env.MAIL_TRANSPORT_ALLOW_STUB !== '1')
      throw new Error('MAIL_TRANSPORT is not set: in production use smtp or microsoft365');
    return stubTransport;
  }
  if (kind === 'smtp') {
    const port = Number(env.SMTP_PORT ?? 465);
    const t = nodemailer.createTransport({
      host: need(env, 'SMTP_HOST'),
      port,
      secure: (env.SMTP_SECURE ?? (port === 465 ? 'true' : 'false')) === 'true',
      auth: { user: need(env, 'SMTP_USER'), pass: need(env, 'SMTP_PASSWORD') },
    });
    return { send: async (m) => void (await t.sendMail(m)) };
  }
  if (kind === 'microsoft365') {
    const user = need(env, 'M365_USER');
    return {
      async send(m) {
        const t = nodemailer.createTransport({
          host: 'smtp.office365.com',
          port: 587,
          secure: false,
          requireTLS: true,
          auth: { type: 'OAuth2', user, accessToken: await microsoftToken(env, fetchImpl) },
        });
        await t.sendMail(m);
      },
    };
  }
  throw new Error(`MAIL_TRANSPORT "${kind}" is not known (use smtp, microsoft365 or stub)`);
}
