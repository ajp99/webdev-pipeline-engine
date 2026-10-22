// The go-live provider (G29). Not built yet on purpose: development runs on a free provider (D-316) and
// nothing here can be tried without a paid key. It fails with a clear message instead of guessing.
import type { ModelClient } from './types';

export function anthropicClient(model: string): ModelClient {
  return {
    name: `anthropic:${model}`,
    async generateJson() {
      throw new Error(
        'MODEL_PROVIDER=anthropic is not built yet (go-live item G29). Use MODEL_PROVIDER=gemini until then.',
      );
    },
  };
}
