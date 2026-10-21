// Stage runner (P2-T04, D-302): claims queued runs, keeps their heartbeat, honours a cancel request,
// stops a run that shows no sign of life, and reports the result. The database decides everything
// about queue order, the one-active-run slot, retries and stale runs (claim_run, finish_run);
// this file only drives those functions.
import type { Database } from '@wpe/shared';

export type Run = Database['public']['Tables']['stage_runs']['Row'];
export type RunStatus = Database['public']['Enums']['run_status'];
export type FinalStatus = 'succeeded' | 'failed' | 'cancelled' | 'stopped';

export type RunnerDeps = {
  claim(worker: string): Promise<Run | null>;
  /** The run's status, or null when this worker no longer holds the run. */
  heartbeat(runId: string, worker: string): Promise<RunStatus | null>;
  finish(runId: string, worker: string, status: FinalStatus, tokens: number): Promise<RunStatus>;
};

export type HandlerContext = {
  run: Run;
  /** Aborted when the run must stop: cancel requested, run lost, or the watchdog fired. */
  signal: AbortSignal;
  /** Call on every sign of life (streamed output, tool call, file write, command output). */
  progress(): void;
};
export type Handler = (ctx: HandlerContext) => Promise<{ tokens?: number } | void>;
export type HandlerSelector = (run: Run) => Handler | undefined;

export type RunnerConfig = {
  worker: string;
  /** How often the heartbeat is sent. The database treats 10 minutes of silence as stale. */
  heartbeatMs: number;
  /** A run with no progress for this long is stopped (20 minutes, D-302). */
  watchdogMs: number;
  /** After an abort, how long to wait for the handler to wind down before reporting anyway. */
  graceMs: number;
  log(message: string): void;
};

export const DEFAULTS = {
  heartbeatMs: 30_000,
  watchdogMs: 20 * 60_000,
  graceMs: 10_000,
  pollMinMs: 15_000,
  pollMaxMs: 30_000,
  maxParallel: 1,
} as const;

export type Outcome = 'succeeded' | 'failed' | 'cancelled' | 'stopped' | 'lost';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function executeRun(
  deps: RunnerDeps,
  run: Run,
  select: HandlerSelector,
  cfg: RunnerConfig,
): Promise<Outcome> {
  const ac = new AbortController();
  let reason: 'cancel' | 'lost' | 'watchdog' | null = null;
  let lastProgress = Date.now();
  const abort = (r: 'cancel' | 'lost' | 'watchdog') => {
    if (reason) return;
    reason = r;
    cfg.log(`run ${run.id}: stopping (${r})`);
    ac.abort();
  };

  const heartbeat = setInterval(() => {
    deps.heartbeat(run.id, cfg.worker).then(
      (status) => {
        if (status === null) abort('lost');
        else if (status === 'cancel_requested') abort('cancel');
      },
      // A failed heartbeat is not fatal: the database only calls a run stale after 10 minutes.
      (e) => cfg.log(`run ${run.id}: heartbeat failed: ${message(e)}`),
    );
  }, cfg.heartbeatMs);
  const watchdog = setInterval(
    () => {
      if (Date.now() - lastProgress >= cfg.watchdogMs) abort('watchdog');
    },
    Math.min(cfg.watchdogMs, 10_000),
  );

  // An async wrapper, so a handler (or the selector) that throws at once is a failed run like any
  // other and the timers below are still cleared.
  const work: Promise<{ tokens?: number } | void> = (async () => {
    const handler = select(run);
    if (!handler) throw new Error(`no handler for stage ${run.stage}`);
    return handler({ run, signal: ac.signal, progress: () => (lastProgress = Date.now()) });
  })();
  const settled = work.then(
    (r) => ({ ok: true as const, tokens: (r && r.tokens) || 0 }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  let graceTimer: ReturnType<typeof setTimeout> | undefined;
  const gaveUp = new Promise<'gave-up'>((resolve) => {
    ac.signal.addEventListener('abort', () => {
      graceTimer = setTimeout(() => resolve('gave-up'), cfg.graceMs);
    });
  });
  const result = await Promise.race([settled, gaveUp]);
  clearInterval(heartbeat);
  clearInterval(watchdog);
  clearTimeout(graceTimer);

  let status: FinalStatus;
  let tokens = 0;
  if (reason === 'lost') {
    cfg.log(`run ${run.id}: another worker holds it now; not reporting`);
    return 'lost';
  } else if (reason === 'cancel') status = 'cancelled';
  else if (reason === 'watchdog') status = 'stopped';
  else if (result !== 'gave-up' && result.ok) {
    status = 'succeeded';
    tokens = result.tokens;
  } else {
    status = 'failed';
    if (result !== 'gave-up' && !result.ok)
      cfg.log(`run ${run.id}: failed: ${message(result.error)}`);
  }
  try {
    const final = await deps.finish(run.id, cfg.worker, status, tokens);
    cfg.log(`run ${run.id}: reported ${status}${final !== status ? `, now ${final}` : ''}`);
  } catch (e) {
    cfg.log(`run ${run.id}: could not report ${status}: ${message(e)}`);
  }
  return status;
}

export type LoopConfig = RunnerConfig & {
  pollMinMs: number;
  pollMaxMs: number;
  maxParallel: number;
};

/** Polls for work every pollMinMs to pollMaxMs and runs up to maxParallel runs (one per project). */
export function startRunner(deps: RunnerDeps, select: HandlerSelector, cfg: LoopConfig) {
  let stopping = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inflight: Promise<void> = Promise.resolve();
  const active = new Set<Promise<unknown>>();

  const tick = async () => {
    try {
      while (!stopping && active.size < cfg.maxParallel) {
        const run = await deps.claim(cfg.worker);
        if (!run) break;
        cfg.log(`run ${run.id}: claimed (${run.stage}, attempt ${run.attempts})`);
        const p: Promise<unknown> = executeRun(deps, run, select, cfg)
          .catch((e) => cfg.log(`run ${run.id}: runner error: ${message(e)}`))
          .finally(() => active.delete(p));
        active.add(p);
      }
    } catch (e) {
      cfg.log(`claim failed: ${message(e)}`);
    }
    if (!stopping) {
      const wait = cfg.pollMinMs + Math.random() * (cfg.pollMaxMs - cfg.pollMinMs);
      timer = setTimeout(() => {
        inflight = tick();
      }, wait);
    }
  };
  inflight = tick();

  return {
    async stop() {
      stopping = true;
      clearTimeout(timer);
      // A claim may be in flight: wait for it so a run it returns is part of what we wait for.
      await inflight;
      await Promise.allSettled([...active]);
    },
  };
}
