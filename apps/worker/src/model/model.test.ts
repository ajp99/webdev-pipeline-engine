import { describe, expect, it, vi } from 'vitest';
import {
  fakeModel,
  generateChecked,
  geminiClient,
  modelFromEnv,
  parseRetryDelay,
  type Parsed,
} from './index';

const parseOk = (raw: unknown): Parsed<{ n: number }> =>
  typeof raw === 'object' && raw !== null && typeof (raw as { n?: unknown }).n === 'number'
    ? { ok: true, value: { n: (raw as { n: number }).n } }
    : { ok: false, error: 'n must be a number' };
const req = { system: 'sys', user: 'usr', schema: { type: 'object' } };

describe('generateChecked', () => {
  it('returns a valid reply at once and counts the tokens', async () => {
    const m = fakeModel('{"n": 1}', 50);
    expect(await generateChecked(m, req, parseOk)).toEqual({ value: { n: 1 }, tokens: 50 });
    expect(m.requests).toHaveLength(1);
  });

  it('asks again once when the reply is not JSON, naming the problem, and adds up the tokens', async () => {
    const m = fakeModel(['not json', '{"n": 2}'], 50);
    expect(await generateChecked(m, req, parseOk)).toEqual({ value: { n: 2 }, tokens: 100 });
    expect(m.requests[1]!.user).toContain('rejected: it was not valid JSON');
    expect(m.requests[1]!.user.startsWith('usr')).toBe(true);
  });

  it('asks again once when the reply does not match, and says what was wrong', async () => {
    const m = fakeModel(['{"n": "x"}', '{"n": 3}']);
    await generateChecked(m, req, parseOk);
    expect(m.requests[1]!.user).toContain('n must be a number');
  });

  it('gives up after the second bad reply', async () => {
    const m = fakeModel(['{"n": "x"}', '{"n": "y"}', '{"n": 4}']);
    await expect(generateChecked(m, req, parseOk)).rejects.toThrow(/rejected twice/);
    expect(m.requests).toHaveLength(2);
  });
});

const KEY = 'SECRET-GEMINI-KEY';
const ok = (text: string, tokens = 7) =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
      usageMetadata: { totalTokenCount: tokens },
    }),
    { status: 200 },
  );
const err = (
  status: number,
  message: string,
  headers: Record<string, string> = {},
  details: unknown[] = [],
) => new Response(JSON.stringify({ error: { message, details } }), { status, headers });

function gem(
  responses: (Response | Error)[],
  extra: Partial<Parameters<typeof geminiClient>[0]> = {},
) {
  const calls: { url: string; init: RequestInit }[] = [];
  const sleeps: number[] = [];
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    if (calls.length > 10) throw new Error('too many calls: the client does not stop retrying');
    const r = responses[Math.min(calls.length, responses.length) - 1]!;
    if (r instanceof Error) throw r;
    return r;
  });
  const client = geminiClient({
    apiKey: KEY,
    model: 'gemini-2.5-flash',
    fetch: f as unknown as typeof fetch,
    sleep: async (ms) => void sleeps.push(ms),
    ...extra,
  });
  return { client, calls, sleeps };
}

describe('geminiClient', () => {
  it('sends the prompt, the schema and the key in a header, not in the address', async () => {
    const { client, calls } = gem([ok('{"a":1}')]);
    await client.generateJson(req);
    const c = calls[0]!;
    expect(c.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    );
    expect(c.url).not.toContain(KEY);
    expect((c.init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY);
    const body = JSON.parse(String(c.init.body));
    expect(body.systemInstruction.parts[0].text).toBe('sys');
    expect(body.contents[0].parts[0].text).toBe('usr');
    expect(body.generationConfig).toMatchObject({
      responseMimeType: 'application/json',
      responseSchema: { type: 'object' },
    });
  });

  it('returns the text and the token count', async () => {
    const { client } = gem([ok('{"a":1}', 42)]);
    expect(await client.generateJson(req)).toEqual({ text: '{"a":1}', tokens: 42 });
  });

  it('waits the time the provider names after a rate limit, then succeeds, and keeps the watchdog fed', async () => {
    const { client, sleeps } = gem([err(429, 'quota', {}, [{ retryDelay: '3s' }]), ok('{"a":1}')]);
    const progress = vi.fn();
    expect((await client.generateJson({ ...req, progress })).text).toBe('{"a":1}');
    expect(sleeps).toEqual([3000]);
    expect(progress.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('counts the start of a rate-limit wait as a sign of life', async () => {
    const events: string[] = [];
    const { client } = gem([err(429, 'quota'), ok('{}')], {
      sleep: async () => void events.push('sleep'),
    });
    await client.generateJson({ ...req, progress: () => void events.push('progress') });
    // start of the attempt, the rate limit (before the wait), the wait, the next attempt, the answer
    expect(events).toEqual(['progress', 'progress', 'sleep', 'progress', 'progress']);
  });

  it('uses Retry-After when there is no retry info, and a default otherwise, never over the cap', async () => {
    const a = gem([err(429, 'q', { 'retry-after': '5' }), ok('{}')]);
    await a.client.generateJson(req);
    expect(a.sleeps).toEqual([5000]);
    const b = gem([err(503, 'busy'), ok('{}')], { defaultWaitMs: 1234 });
    await b.client.generateJson(req);
    expect(b.sleeps).toEqual([1234]);
    const c = gem([err(429, 'q', {}, [{ retryDelay: '600s' }]), ok('{}')], { maxWaitMs: 90_000 });
    await c.client.generateJson(req);
    expect(c.sleeps).toEqual([90_000]);
  });

  it('gives up after the allowed attempts', async () => {
    const { client, calls } = gem([err(429, 'quota')], { maxAttempts: 3 });
    await expect(client.generateJson(req)).rejects.toThrow(/429/);
    expect(calls).toHaveLength(3);
  });

  it('does not retry an error that is not a rate limit', async () => {
    const { client, calls, sleeps } = gem([err(400, 'bad schema')]);
    await expect(client.generateJson(req)).rejects.toThrow(/400: bad schema/);
    expect(calls).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it('stops waiting when the run is stopped', async () => {
    const ac = new AbortController();
    const { client, calls } = gem([err(429, 'quota'), ok('{}')], {
      sleep: async () => ac.abort(),
    });
    await expect(client.generateJson({ ...req, signal: ac.signal })).rejects.toThrow(/stopped/);
    expect(calls).toHaveLength(1);
  });

  it('reports a blocked request and an empty answer', async () => {
    const blocked = new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), {
      status: 200,
    });
    await expect(gem([blocked]).client.generateJson(req)).rejects.toThrow(/blocked.*SAFETY/);
    const empty = new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS' }] }), {
      status: 200,
    });
    await expect(gem([empty]).client.generateJson(req)).rejects.toThrow(/no text.*MAX_TOKENS/);
  });

  it('never puts the key in an error', async () => {
    for (const r of [err(401, `bad key ${'x'}`), new Error('network down')]) {
      const { client } = gem([r]);
      const e = await client.generateJson(req).catch((x: Error) => x);
      expect(String((e as Error).message)).not.toContain(KEY);
    }
  });

  it('names the model without the key', () => {
    expect(gem([]).client.name).toBe('gemini:gemini-2.5-flash');
  });
});

describe('parseRetryDelay', () => {
  it('reads seconds and ignores the rest', () => {
    expect(parseRetryDelay('20s')).toBe(20_000);
    expect(parseRetryDelay('1.5s')).toBe(1500);
    expect(parseRetryDelay('soon')).toBeUndefined();
    expect(parseRetryDelay(5)).toBeUndefined();
  });
});

describe('modelFromEnv', () => {
  it('says what is missing', () => {
    expect(() => modelFromEnv({})).toThrow(/MODEL_PROVIDER is not set/);
    expect(() => modelFromEnv({ MODEL_PROVIDER: 'gemini' })).toThrow(/MODEL_NAME is not set/);
    expect(() => modelFromEnv({ MODEL_PROVIDER: 'gemini', MODEL_NAME: 'm' })).toThrow(
      /GEMINI_API_KEY is not set/,
    );
    expect(() => modelFromEnv({ MODEL_PROVIDER: 'nope', MODEL_NAME: 'm' })).toThrow(/not known/);
  });

  it('builds Gemini from the settings', () => {
    const m = modelFromEnv({
      MODEL_PROVIDER: 'gemini',
      MODEL_NAME: 'gemini-2.5-flash',
      GEMINI_API_KEY: KEY,
    });
    expect(m.name).toBe('gemini:gemini-2.5-flash');
  });

  it('gives Anthropic a clear error until go-live', async () => {
    const m = modelFromEnv({ MODEL_PROVIDER: 'anthropic', MODEL_NAME: 'm' });
    await expect(m.generateJson(req)).rejects.toThrow(/G29/);
  });
});
