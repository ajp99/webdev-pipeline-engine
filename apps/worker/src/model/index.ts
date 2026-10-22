import { anthropicClient } from './anthropic';
import { geminiClient } from './gemini';
import type { ModelClient } from './types';

export * from './types';
export { fakeModel } from './fake';
export { geminiClient, parseRetryDelay } from './gemini';

/** The model named in apps/worker/.env (D-316), or an error that says what is missing. */
export function modelFromEnv(env: Record<string, string | undefined>): ModelClient {
  const provider = env.MODEL_PROVIDER?.trim();
  const model = env.MODEL_NAME?.trim();
  if (!provider)
    throw new Error('MODEL_PROVIDER is not set in apps/worker/.env (gemini or anthropic)');
  if (!model) throw new Error('MODEL_NAME is not set in apps/worker/.env');
  if (provider === 'gemini') {
    const apiKey = env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set in apps/worker/.env');
    return geminiClient({ apiKey, model });
  }
  if (provider === 'anthropic') return anthropicClient(model);
  throw new Error(`MODEL_PROVIDER "${provider}" is not known (use gemini or anthropic)`);
}
