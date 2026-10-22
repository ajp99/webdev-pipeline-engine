// A model for tests: answers come from a function or a fixed list, and every request is recorded.
import type { JsonRequest, JsonResponse, ModelClient } from './types';

export function fakeModel(
  answer: string | ((req: JsonRequest, call: number) => string | Promise<string>) | string[],
  tokensPerCall = 100,
): ModelClient & { requests: JsonRequest[] } {
  const requests: JsonRequest[] = [];
  return {
    name: 'fake:model',
    requests,
    async generateJson(req): Promise<JsonResponse> {
      requests.push(req);
      const call = requests.length;
      const text = Array.isArray(answer)
        ? (answer[Math.min(call, answer.length) - 1] as string)
        : typeof answer === 'function'
          ? await answer(req, call)
          : answer;
      return { text, tokens: tokensPerCall };
    },
  };
}
