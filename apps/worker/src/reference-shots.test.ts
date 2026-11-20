import { describe, expect, it, vi } from 'vitest';
import {
  checkUrl,
  isPublicIp,
  MAX_SITES,
  takeShots,
  type Resolver,
  type ShotBrowser,
} from './reference-shots';

// A fake DNS: example.org is public; evil.example points at a private address (DNS rebinding style).
const resolver: Resolver = async (host) => {
  const table: Record<string, string[]> = {
    'example.org': ['93.184.215.14'],
    'cdn.example.org': ['93.184.215.15'],
    'evil.example': ['10.0.0.5'],
    'mixed.example': ['93.184.215.14', '127.0.0.1'],
    'v6.example': ['2606:2800:220:1::1'],
  };
  if (!table[host]) throw new Error('ENOTFOUND');
  return table[host]!;
};

describe('isPublicIp', () => {
  it.each([
    ['127.0.0.1', false],
    ['10.1.2.3', false],
    ['172.20.0.1', false],
    ['192.168.1.1', false],
    ['169.254.169.254', false],
    ['100.64.0.1', false],
    ['0.0.0.0', false],
    ['::1', false],
    ['fd00::1', false],
    ['fe80::1', false],
    ['::ffff:10.0.0.1', false],
    ['93.184.215.14', true],
    ['2606:2800:220:1::1', true],
    ['not-an-ip', false],
  ])('%s is public: %s', (ip, want) => expect(isPublicIp(ip)).toBe(want));
});

describe('checkUrl refuses anything that is not a public web address', () => {
  it.each([
    ['http://localhost:3000', 'standard web ports'],
    ['http://localhost', 'not a public address'],
    ['http://127.0.0.1/', 'not a public address'],
    ['http://169.254.169.254/latest/meta-data/', 'not a public address'],
    ['http://metadata.google.internal/', 'not a public address'],
    ['http://[::1]/', 'not a public address'],
    ['http://10.0.0.1/', 'not a public address'],
    ['http://intranet/', 'not a public address'],
    ['https://evil.example/', 'not a public address'],
    ['https://mixed.example/', 'not a public address'],
    ['https://nowhere.example/', 'does not resolve'],
    ['file:///etc/passwd', 'only http and https'],
    ['ftp://example.org/', 'only http and https'],
    ['https://user:pw@example.org/', 'user name or password'],
    ['https://example.org:8443/', 'standard web ports'],
    ['not a url', 'not a web address'],
  ])('%s', async (url, reason) => {
    const r = await checkUrl(url, resolver);
    expect(r.ok ? 'ok' : r.reason).toContain(reason);
  });
  it('accepts public sites over IPv4 and IPv6', async () => {
    expect((await checkUrl('https://example.org/about', resolver)).ok).toBe(true);
    expect((await checkUrl('https://v6.example/', resolver)).ok).toBe(true);
  });
});

function fakeBrowser(
  behaviour: (url: string, allow: (u: string) => Promise<boolean>) => Promise<Buffer>,
) {
  const b: ShotBrowser & { close: ReturnType<typeof vi.fn> } = {
    shoot: vi.fn((url, allow) => behaviour(url, allow)),
    close: vi.fn(async () => {}),
  };
  return b;
}

describe('takeShots', () => {
  it('shoots only the first three distinct sites, reports refusals, and closes the browser', async () => {
    const b = fakeBrowser(async () => Buffer.from('jpeg'));
    const shots = await takeShots(
      [
        'https://example.org/',
        'https://example.org/',
        'http://127.0.0.1/',
        'https://cdn.example.org/',
        'https://v6.example/',
      ],
      b,
      resolver,
    );
    expect(shots.map((s) => [s.url, s.ok])).toEqual([
      ['https://example.org/', true],
      ['http://127.0.0.1/', false],
      ['https://cdn.example.org/', true],
    ]);
    expect(MAX_SITES).toBe(3);
    expect(b.close).toHaveBeenCalledOnce();
  });
  it('returns only an image, never page text', async () => {
    const [s] = await takeShots(
      ['https://example.org/'],
      fakeBrowser(async () => Buffer.from('jpeg')),
      resolver,
    );
    expect(Object.keys(s!).sort()).toEqual(['image', 'ok', 'url']);
  });
  it('gives up on a slow page with "timed out"', async () => {
    vi.useFakeTimers();
    const b = fakeBrowser(() => new Promise<Buffer>(() => {}));
    const p = takeShots(['https://example.org/'], b, resolver);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await p).toEqual([{ url: 'https://example.org/', ok: false, reason: 'timed out' }]);
    vi.useRealTimers();
  });
  it('checks every request the page makes: private hosts and odd ports are blocked, data URLs pass', async () => {
    const seen: Record<string, boolean> = {};
    const b = fakeBrowser(async (_url, allow) => {
      for (const u of [
        'https://cdn.example.org/a.png',
        'https://evil.example/x.js',
        'http://169.254.169.254/',
        'https://example.org:8443/',
        'data:image/png;base64,AA',
      ])
        seen[u] = await allow(u);
      return Buffer.from('jpeg');
    });
    await takeShots(['https://example.org/'], b, resolver);
    expect(seen).toEqual({
      'https://cdn.example.org/a.png': true,
      'https://evil.example/x.js': false,
      'http://169.254.169.254/': false,
      'https://example.org:8443/': false,
      'data:image/png;base64,AA': true,
    });
  });
  it('reports a page that fails to open without its error text', async () => {
    const [s] = await takeShots(
      ['https://example.org/'],
      fakeBrowser(async () => Promise.reject(new Error('net::ERR_x secret'))),
      resolver,
    );
    expect(s).toEqual({
      url: 'https://example.org/',
      ok: false,
      reason: 'the page could not be opened',
    });
  });
});
