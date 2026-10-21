// Which handler runs which stage run. Real handlers (intake review, P2-T05, and later stages) are
// added here. A stub run (model = 'stub') does a trivial task so the runner path can be proven
// end to end: claim, heartbeat, cancel and a result.
import type { Handler, HandlerSelector } from './runner';

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const done = () => {
      clearTimeout(t);
      resolve();
    };
    const t = setTimeout(() => {
      signal.removeEventListener('abort', done);
      resolve();
    }, ms);
    signal.addEventListener('abort', done, { once: true });
  });
}

export function stubHandler(opts: { steps: number; stepMs: number }): Handler {
  return async ({ signal, progress }) => {
    for (let i = 0; i < opts.steps; i++) {
      await sleep(opts.stepMs, signal);
      if (signal.aborted) throw new Error('stopped');
      progress();
    }
    return { tokens: 0 };
  };
}

export function defaultSelector(env: {
  STUB_STEPS?: string;
  STUB_STEP_SECONDS?: string;
}): HandlerSelector {
  // About 60 seconds by default, so there is time to press Cancel in the console.
  const stub = stubHandler({
    steps: Number(env.STUB_STEPS ?? 12),
    stepMs: Number(env.STUB_STEP_SECONDS ?? 5) * 1000,
  });
  return (run) => (run.model === 'stub' ? stub : undefined);
}
