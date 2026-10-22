// Gemini over its REST API (Google AI Studio key, free tier in development, D-316). No SDK: one fetch.
import { ModelError, type JsonRequest, type JsonResponse, type ModelClient } from './types';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export type GeminiOptions = {
  apiKey: string;
  model: string;
  fetch?: typeof fetch;
  /** Waits between attempts after a rate limit; injectable for tests. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  maxAttempts?: number;
  /** Used when the provider names no wait. */
  defaultWaitMs?: number;
  /** Never wait longer than this for one rate limit. */
  maxWaitMs?: number;
};

export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      signal?.removeEventListener('abort', done);
      resolve();
    }
    signal?.addEventListener('abort', done, { once: true });
  });
}

/** "20s" or "20.5s" (Google's RetryInfo) to milliseconds. */
export function parseRetryDelay(v: unknown): number | undefined {
  if (typeof v !== 'string') return undefined;
  const m = /^(\d+(?:\.\d+)?)s$/.exec(v);
  return m ? Math.ceil(Number(m[1]) * 1000) : undefined;
}

type GeminiBody = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: { totalTokenCount?: number };
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; details?: { retryDelay?: string }[] };
};

export function geminiClient(opts: GeminiOptions): ModelClient {
  const doFetch = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? abortableSleep;
  const maxAttempts = opts.maxAttempts ?? 4;
  const defaultWait = opts.defaultWaitMs ?? 20_000;
  const maxWait = opts.maxWaitMs ?? 90_000;
  const url = `${BASE}/${encodeURIComponent(opts.model)}:generateContent`;

  return {
    name: `gemini:${opts.model}`,
    async generateJson(req: JsonRequest): Promise<JsonResponse> {
      const body = JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: [{ text: req.user }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: req.schema,
          temperature: 0.2,
        },
      });
      for (let attempt = 1; ; attempt++) {
        req.progress?.();
        let res: Response;
        try {
          res = await doFetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': opts.apiKey },
            body,
            signal: req.signal,
          });
        } catch (e) {
          if (req.signal?.aborted) throw new ModelError('the request was stopped');
          throw new ModelError(
            `could not reach Gemini: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
        const data = (await res.json().catch(() => ({}))) as GeminiBody;
        if (res.ok) {
          req.progress?.();
          if (data.promptFeedback?.blockReason)
            throw new ModelError(`Gemini blocked the request: ${data.promptFeedback.blockReason}`);
          const cand = data.candidates?.[0];
          const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('');
          if (!text)
            throw new ModelError(
              `Gemini returned no text (finish reason: ${cand?.finishReason ?? 'none'})`,
            );
          return { text, tokens: data.usageMetadata?.totalTokenCount ?? 0 };
        }
        const retriable = res.status === 429 || res.status === 503;
        if (retriable && attempt < maxAttempts) {
          const asked =
            parseRetryDelay(data.error?.details?.find((d) => d.retryDelay)?.retryDelay) ??
            (Number(res.headers.get('retry-after')) * 1000 || undefined);
          // A wait is a sign of life, not a hang: it keeps the watchdog quiet.
          req.progress?.();
          await sleep(Math.min(asked ?? defaultWait, maxWait), req.signal);
          if (req.signal?.aborted) throw new ModelError('the request was stopped');
          continue;
        }
        throw new ModelError(
          `Gemini answered ${res.status}: ${data.error?.message ?? res.statusText}`.slice(0, 400),
          res.status,
          retriable ? maxWait : undefined,
        );
      }
    },
  };
}
