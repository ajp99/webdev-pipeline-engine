import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  executeRun,
  startRunner,
  type FinalStatus,
  type Handler,
  type Run,
  type RunnerConfig,
  type RunnerDeps,
  type RunStatus,
} from './runner';
import { stubHandler } from './handlers';

const run = (over: Partial<Run> = {}): Run => ({
  id: 'r1',
  project_id: 'p1',
  stage: 'intake',
  status: 'running',
  queued_at: '2026-01-01T00:00:00Z',
  claimed_by: 'w1',
  heartbeat_at: null,
  attempts: 1,
  tokens_used: 0,
  started_at: null,
  finished_at: null,
  trace_id: 't1',
  model: null,
  prompt_hash: null,
  ...over,
});

function fakeDeps(over: Partial<RunnerDeps> = {}) {
  const finished: { status: FinalStatus; tokens: number }[] = [];
  const queue: Run[] = [];
  const deps: RunnerDeps = {
    claim: async () => queue.shift() ?? null,
    heartbeat: async () => 'running',
    finish: async (_id, _w, status, tokens) => {
      finished.push({ status, tokens });
      return status;
    },
    ...over,
  };
  return { deps, finished, queue };
}
const cfg = (over: Partial<RunnerConfig> = {}): RunnerConfig => ({
  worker: 'w1',
  heartbeatMs: 1000,
  watchdogMs: 20 * 60_000,
  graceMs: 500,
  log: () => {},
  ...over,
});
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const neverEnds: Handler = ({ signal }) =>
  new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('executeRun', () => {
  it('reports success with the tokens the handler used', async () => {
    const { deps, finished } = fakeDeps();
    const out = await executeRun(deps, run(), () => async () => ({ tokens: 42 }), cfg());
    expect(out).toBe('succeeded');
    expect(finished).toEqual([{ status: 'succeeded', tokens: 42 }]);
  });

  it('reports failure when the handler throws', async () => {
    const { deps, finished } = fakeDeps();
    const out = await executeRun(
      deps,
      run(),
      () => async () => Promise.reject(new Error('boom')),
      cfg(),
    );
    expect(out).toBe('failed');
    expect(finished).toEqual([{ status: 'failed', tokens: 0 }]);
  });

  it('reports failure and stops its timers when the handler throws at once', async () => {
    const beats: string[] = [];
    const { deps, finished } = fakeDeps({
      heartbeat: async (id) => {
        beats.push(id);
        return 'running';
      },
    });
    const out = await executeRun(
      deps,
      run(),
      () => () => {
        throw new Error('sync boom');
      },
      cfg(),
    );
    await vi.advanceTimersByTimeAsync(10_000);
    expect(out).toBe('failed');
    expect(finished).toEqual([{ status: 'failed', tokens: 0 }]);
    expect(beats).toEqual([]);
  });

  it('reports failure when the selector itself throws', async () => {
    const { deps, finished } = fakeDeps();
    const out = await executeRun(
      deps,
      run(),
      () => {
        throw new Error('bad selector');
      },
      cfg(),
    );
    expect(out).toBe('failed');
    expect(finished).toHaveLength(1);
  });

  it('reports failure when no handler exists for the run', async () => {
    const { deps, finished } = fakeDeps();
    await executeRun(deps, run(), () => undefined, cfg());
    expect(finished).toEqual([{ status: 'failed', tokens: 0 }]);
  });

  it('sends heartbeats while the handler works', async () => {
    const beats: string[] = [];
    const { deps } = fakeDeps({
      heartbeat: async (id) => {
        beats.push(id);
        return 'running';
      },
    });
    const p = executeRun(deps, run(), () => async () => sleep(3500), cfg());
    await vi.advanceTimersByTimeAsync(4000);
    await p;
    expect(beats).toEqual(['r1', 'r1', 'r1']);
  });

  it('stops the handler and reports cancelled when the heartbeat shows a cancel request', async () => {
    const { deps, finished } = fakeDeps({ heartbeat: async () => 'cancel_requested' as RunStatus });
    const p = executeRun(deps, run(), () => neverEnds, cfg());
    await vi.advanceTimersByTimeAsync(1500);
    expect(await p).toBe('cancelled');
    expect(finished).toEqual([{ status: 'cancelled', tokens: 0 }]);
  });

  it('stops and reports nothing when another worker holds the run', async () => {
    const { deps, finished } = fakeDeps({ heartbeat: async () => null });
    const p = executeRun(deps, run(), () => neverEnds, cfg());
    await vi.advanceTimersByTimeAsync(1500);
    expect(await p).toBe('lost');
    expect(finished).toEqual([]);
  });

  it('keeps working through a failed heartbeat', async () => {
    const { deps, finished } = fakeDeps({
      heartbeat: async () => Promise.reject(new Error('network')),
    });
    const p = executeRun(deps, run(), () => async () => sleep(2500), cfg());
    await vi.advanceTimersByTimeAsync(3000);
    expect(await p).toBe('succeeded');
    expect(finished).toHaveLength(1);
  });

  it('stops a run with no sign of life for the watchdog time', async () => {
    const { deps, finished } = fakeDeps();
    const p = executeRun(deps, run(), () => neverEnds, cfg({ watchdogMs: 60_000 }));
    await vi.advanceTimersByTimeAsync(61_000);
    expect(await p).toBe('stopped');
    expect(finished).toEqual([{ status: 'stopped', tokens: 0 }]);
  });

  it('does not stop a run that keeps showing progress', async () => {
    const { deps, finished } = fakeDeps();
    const handler: Handler = async ({ progress }) => {
      for (let i = 0; i < 6; i++) {
        await sleep(30_000);
        progress();
      }
    };
    const p = executeRun(deps, run(), () => handler, cfg({ watchdogMs: 60_000 }));
    await vi.advanceTimersByTimeAsync(200_000);
    expect(await p).toBe('succeeded');
    expect(finished[0]!.status).toBe('succeeded');
  });

  it('reports anyway when a handler ignores the abort', async () => {
    const { deps, finished } = fakeDeps({ heartbeat: async () => 'cancel_requested' as RunStatus });
    const p = executeRun(deps, run(), () => () => new Promise<void>(() => {}), cfg());
    await vi.advanceTimersByTimeAsync(2500);
    expect(await p).toBe('cancelled');
    expect(finished).toHaveLength(1);
  });

  it('survives a failure to report', async () => {
    const { deps } = fakeDeps({ finish: async () => Promise.reject(new Error('db down')) });
    const out = await executeRun(deps, run(), () => async () => ({ tokens: 1 }), cfg());
    expect(out).toBe('succeeded');
  });
});

describe('stub handler', () => {
  it('finishes after its steps and shows progress each step', async () => {
    let ticks = 0;
    const ac = new AbortController();
    const p = stubHandler({ steps: 3, stepMs: 100 })({
      run: run(),
      signal: ac.signal,
      progress: () => ticks++,
    });
    await vi.advanceTimersByTimeAsync(350);
    await p;
    expect(ticks).toBe(3);
  });

  it('stops early when aborted', async () => {
    const ac = new AbortController();
    const p = stubHandler({ steps: 10, stepMs: 1000 })({
      run: run(),
      signal: ac.signal,
      progress: () => {},
    });
    const caught = p.catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(1500);
    ac.abort();
    await vi.advanceTimersByTimeAsync(10);
    expect(await caught).toBe('stopped');
  });
});

describe('startRunner', () => {
  const loopCfg = (over = {}) => ({
    ...cfg(),
    pollMinMs: 1000,
    pollMaxMs: 1000,
    maxParallel: 1,
    ...over,
  });

  it('claims work, runs it, and polls again later', async () => {
    const { deps, queue, finished } = fakeDeps();
    const r = startRunner(deps, () => async () => ({ tokens: 1 }), loopCfg());
    await vi.advanceTimersByTimeAsync(10);
    expect(finished).toHaveLength(0);
    queue.push(run({ id: 'late' }));
    await vi.advanceTimersByTimeAsync(1500);
    expect(finished).toHaveLength(1);
    await r.stop();
  });

  it('never runs more than maxParallel runs at once', async () => {
    const { deps, queue } = fakeDeps();
    queue.push(run({ id: 'a' }), run({ id: 'b' }), run({ id: 'c' }));
    let running = 0;
    let peak = 0;
    const handler: Handler = async () => {
      running++;
      peak = Math.max(peak, running);
      await sleep(5000);
      running--;
    };
    const r = startRunner(deps, () => handler, loopCfg({ maxParallel: 2 }));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(peak).toBe(2);
    expect(queue).toHaveLength(0);
    await r.stop();
  });

  it('keeps polling after a failed claim', async () => {
    let calls = 0;
    const { deps } = fakeDeps({
      claim: async () => {
        calls++;
        if (calls === 1) throw new Error('db down');
        return null;
      },
    });
    const r = startRunner(deps, () => undefined, loopCfg());
    await vi.advanceTimersByTimeAsync(3500);
    expect(calls).toBeGreaterThanOrEqual(3);
    await r.stop();
  });

  it('a run claimed while stop is called still finishes before stop returns', async () => {
    const { deps, finished } = fakeDeps();
    let release: (r: Run | null) => void = () => {};
    deps.claim = () => new Promise<Run | null>((resolve) => (release = resolve));
    const r = startRunner(deps, () => async () => sleep(2000), loopCfg());
    await vi.advanceTimersByTimeAsync(10);
    let stopped = false;
    const stopping = r.stop().then(() => (stopped = true));
    release(run({ id: 'late' }));
    await vi.advanceTimersByTimeAsync(1000);
    expect(stopped).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    await stopping;
    expect(finished).toHaveLength(1);
  });

  it('stop waits for the running run and then claims nothing more', async () => {
    const { deps, queue, finished } = fakeDeps();
    queue.push(run({ id: 'a' }), run({ id: 'b' }));
    const r = startRunner(deps, () => async () => sleep(3000), loopCfg());
    await vi.advanceTimersByTimeAsync(100);
    const stopped = r.stop();
    await vi.advanceTimersByTimeAsync(5000);
    await stopped;
    expect(finished).toHaveLength(1);
    expect(queue).toHaveLength(1);
  });
});
