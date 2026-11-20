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
    const b = ipv6Bytes(ip);
    if (!b) return false;
    const v4 = (o: number) => `${b[o]}.${b[o + 1]}.${b[o + 2]}.${b[o + 3]}`;
    const zero = (from: number, to: number) => b.slice(from, to).every((x) => x === 0);
    // Forms that carry an IPv4 address are judged by that address (the URL parser writes ::ffff:127.0.0.1 as
    // ::ffff:7f00:1, so the check works on bytes, not on text): mapped ::ffff:0:0/96, compatible ::/96 (which
    // includes :: and ::1), NAT64 64:ff9b::/96 and 6to4 2002::/16.
    if (zero(0, 10) && b[10] === 0xff && b[11] === 0xff) return isPublicIp(v4(12));
    if (zero(0, 12)) return isPublicIp(v4(12));
    if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b && zero(4, 12))
      return isPublicIp(v4(12));
    if (b[0] === 0x20 && b[1] === 0x02) return isPublicIp(v4(2));
    if ((b[0]! & 0xfe) === 0xfc) return false; // unique local fc00::/7
    if (b[0] === 0xfe && (b[1]! & 0xc0) >= 0x80) return false; // link-local fe80::/10, site-local fec0::/10
    if (b[0] === 0xff) return false; // multicast
    if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return false; // documentation
    if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0x00) return false; // Teredo (hides an IPv4)
    if (b[0] === 0x01 && zero(1, 8)) return false; // discard-only 100::/64
    return true;
  }
  return false;
}

/** An IPv6 address as 16 bytes (with a dotted IPv4 tail allowed), or null when it is not one. */
export function ipv6Bytes(ip: string): number[] | null {
  let a = ip.toLowerCase().replace(/%.*$/, '');
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(a);
  if (dotted) {
    if (isIP(dotted[1]!) !== 4) return null;
    const o = dotted[1]!.split('.').map(Number);
    a =
      a.slice(0, -dotted[1]!.length) +
      `${((o[0]! << 8) | o[1]!).toString(16)}:${((o[2]! << 8) | o[3]!).toString(16)}`;
  }
  const halves = a.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    const n = parseInt(g, 16);
    out.push(n >> 8, n & 0xff);
  }
  return out.length === 16 ? out : null;
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

/**
 * For one response: may the browser receive it? A redirect is allowed only when its Location (resolved against
 * the request) passes the same check, because the browser's request interception sees only the first URL of a
 * redirect chain (gate review): every hop is fetched here and checked before the browser may follow it.
 */
export async function responseAllowed(
  requestUrl: string,
  status: number,
  location: string | undefined,
  allow: (url: string) => Promise<boolean>,
): Promise<boolean> {
  if (status < 300 || status >= 400) return true;
  if (!location) return false;
  let next: string;
  try {
    next = new URL(location, requestUrl).href;
  } catch {
    return false;
  }
  return allow(next);
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
