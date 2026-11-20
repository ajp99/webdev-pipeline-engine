// The reference-site screenshot tool (P3-T12, D-188): opens only the sites the client listed (up to 3) and
// returns screenshots, never page text. Public web addresses only: no localhost, private networks or cloud
// metadata addresses, checked before the visit and again for every request the page makes, with a short timeout.
// It is the one narrow exception to the command allowlist.
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const MAX_SITES = 3;
export const TIMEOUT_MS = 15_000;
export const VIEWPORT = { width: 1280, height: 800 };
/** Full-page shots are cut at this height so a very long page stays a small image. */
export const MAX_HEIGHT = 4000;

const BLOCKED_V4: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // link-local, including the cloud metadata address 169.254.169.254
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const v4num = (ip: string) => ip.split('.').reduce((n, o) => n * 256 + Number(o), 0);

/** True for an address on the public internet; false for loopback, private, link-local, reserved and so on. */
export function isPublicIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    const n = v4num(ip);
    return !BLOCKED_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (n & mask) >>> 0 === (v4num(base) & mask) >>> 0;
    });
  }
  if (kind === 6) {
    const a = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
    if (mapped) return isPublicIp(mapped[1]!);
    if (a === '::' || a === '::1') return false;
    // Unique local fc00::/7, link-local fe80::/10, multicast ff00::/8, documentation 2001:db8::/32.
    if (/^f[cd]/.test(a) || /^fe[89ab]/.test(a) || a.startsWith('ff') || a.startsWith('2001:db8'))
      return false;
    return true;
  }
  return false;
}

export type Resolver = (host: string) => Promise<string[]>;
export const dnsResolver: Resolver = async (host) =>
  (await lookup(host, { all: true, verbatim: true })).map((r) => r.address);

const BLOCKED_NAMES = /(^|\.)(localhost|local|internal|localdomain|home\.arpa)$/i;

/** The URL to visit, or why it is refused. The hostname must resolve only to public addresses. */
export async function checkUrl(
  raw: string,
  resolve: Resolver = dnsResolver,
): Promise<{ ok: true; url: URL } | { ok: false; reason: string }> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'not a web address' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    return { ok: false, reason: 'only http and https addresses' };
  if (url.username || url.password)
    return { ok: false, reason: 'addresses with a user name or password are refused' };
  if (url.port && url.port !== '80' && url.port !== '443')
    return { ok: false, reason: 'only the standard web ports' };
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (BLOCKED_NAMES.test(host) || (!host.includes('.') && !isIP(host)))
    return { ok: false, reason: 'not a public address' };
  let addresses: string[];
  if (isIP(host)) addresses = [host];
  else {
    try {
      addresses = await resolve(host);
    } catch {
      return { ok: false, reason: 'the address does not resolve' };
    }
  }
  if (addresses.length === 0 || !addresses.every(isPublicIp))
    return { ok: false, reason: 'not a public address' };
  return { ok: true, url };
}

/** The part of a browser the tool uses (Playwright's chromium in the worker; a fake in tests). */
export interface ShotBrowser {
  /** Opens the page, letting each request through only if `allow` says so, and returns a JPEG screenshot. */
  shoot(
    url: string,
    allow: (requestUrl: string) => Promise<boolean>,
    timeoutMs: number,
  ): Promise<Buffer>;
  close(): Promise<void>;
}

export type Shot =
  { url: string; ok: true; image: Buffer } | { url: string; ok: false; reason: string };

/** Screenshots of the first MAX_SITES addresses. Each failure is reported with its reason; nothing returns page text. */
export async function takeShots(
  urls: string[],
  browser: ShotBrowser,
  resolve: Resolver = dnsResolver,
): Promise<Shot[]> {
  const out: Shot[] = [];
  const verdicts = new Map<string, Promise<boolean>>();
  // Every request the page makes (images, scripts, redirects) is checked the same way, once per host.
  const allow = (requestUrl: string) => {
    let host: string;
    try {
      const u = new URL(requestUrl);
      if (u.protocol === 'data:' || u.protocol === 'blob:') return Promise.resolve(true);
      host = `${u.protocol}//${u.host}`;
    } catch {
      return Promise.resolve(false);
    }
    if (!verdicts.has(host))
      verdicts.set(
        host,
        checkUrl(host, resolve).then((r) => r.ok),
      );
    return verdicts.get(host)!;
  };
  try {
    for (const raw of [...new Set(urls)].slice(0, MAX_SITES)) {
      const checked = await checkUrl(raw, resolve);
      if (!checked.ok) {
        out.push({ url: raw, ok: false, reason: checked.reason });
        continue;
      }
      try {
        const image = await withTimeout(
          browser.shoot(checked.url.href, allow, TIMEOUT_MS),
          TIMEOUT_MS + 2000,
        );
        out.push({ url: raw, ok: true, image });
      } catch (e) {
        out.push({
          url: raw,
          ok: false,
          reason: /timed? ?out/i.test(String(e)) ? 'timed out' : 'the page could not be opened',
        });
      }
    }
  } finally {
    await browser.close();
  }
  return out;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error('timed out')), ms);
    p.then(
      (v) => (clearTimeout(t), ok(v)),
      (e) => (clearTimeout(t), fail(e)),
    );
  });
}
