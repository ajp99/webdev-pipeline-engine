// A provider-neutral way to ask a model for JSON (D-275, D-316). Single-shot roles use only this, so the
// provider is a setting in apps/worker/.env and not a code change.

export type JsonRequest = {
  system: string;
  user: string;
  /** JSON Schema the reply must follow. */
  schema: object;
  signal?: AbortSignal;
  /** Called on every sign of life, including while waiting out a rate limit (feeds the watchdog). */
  progress?: () => void;
};

export type JsonResponse = { text: string; tokens: number };

export interface ModelClient {
  /** For logs and the artifact, e.g. "gemini:gemini-2.5-flash". Never contains a key. */
  readonly name: string;
  generateJson(req: JsonRequest): Promise<JsonResponse>;
}

/** An error from a provider. The message never contains the API key. */
export class ModelError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** Set for a rate limit: how long the provider asks us to wait. */
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ModelError';
  }
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Asks for JSON and checks it. A reply that is not JSON, or does not pass `parse`, is asked for once
 * more with the problem named; a second bad reply is an error (the run then fails to the owner's queue).
 */
export async function generateChecked<T>(
  client: ModelClient,
  req: JsonRequest,
  parse: (raw: unknown) => Parsed<T>,
): Promise<{ value: T; tokens: number }> {
  let tokens = 0;
  let problem = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    const user =
      attempt === 1
        ? req.user
        : `${req.user}\n\nYour previous answer was rejected: ${problem}\nAnswer again with JSON that matches the schema exactly.`;
    const res = await client.generateJson({ ...req, user });
    tokens += res.tokens;
    let raw: unknown;
    try {
      raw = JSON.parse(res.text);
    } catch {
      problem = 'it was not valid JSON';
      continue;
    }
    const parsed = parse(raw);
    if (parsed.ok) return { value: parsed.value, tokens };
    problem = parsed.error;
  }
  throw new Error(`the model's answer was rejected twice: ${problem}`);
}
