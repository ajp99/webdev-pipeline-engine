// Display rules for stage runs in the owner console (P2-T04). Pure, so they can be tested.
export type RunRowData = {
  id: string;
  projectName: string;
  stage: string;
  status: string;
  attempts: number;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  tokensUsed: number;
  model: string | null;
};

export const ACTIVE_STATUSES = ['running', 'waiting', 'cancel_requested'] as const;

/** The Cancel button works on a run that has not finished (the database refuses the rest). */
export function canCancel(status: string): boolean {
  return status === 'queued' || status === 'running' || status === 'waiting';
}

export function isActive(status: string): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(status) || status === 'queued';
}

const LABELS: Record<string, string> = {
  queued: 'Queued',
  running: 'Running',
  waiting: 'Waiting',
  cancel_requested: 'Stopping',
  succeeded: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
  stopped: 'Stopped (no activity)',
};
export function statusLabel(status: string): string {
  return LABELS[status] ?? status;
}

export function durationLabel(
  startedAt: string | null,
  finishedAt: string | null,
  now: Date,
): string {
  if (!startedAt) return '';
  const end = finishedAt ? new Date(finishedAt) : now;
  const s = Math.max(0, Math.round((end.getTime() - new Date(startedAt).getTime()) / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min ${s % 60} s` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** A run that ended without finishing its work can be run again: a new queued run for the same stage. */
export function canRetry(status: string): boolean {
  return status === 'failed' || status === 'stopped' || status === 'cancelled';
}

export const LOG_PAGE_SIZE = 100;

export type LogWindow = { page: number; pages: number; from: number; to: number };

/**
 * Which log rows to read for a page (1-based). With no page asked for, the last one, where the newest
 * lines are. A page outside the range is moved to the nearest page that exists.
 */
export function logWindow(total: number, wanted: number | null, size = LOG_PAGE_SIZE): LogWindow {
  const pages = Math.max(1, Math.ceil(total / size));
  const raw = wanted === null || !Number.isFinite(wanted) ? pages : Math.trunc(wanted);
  const page = Math.min(pages, Math.max(1, raw));
  return { page, pages, from: (page - 1) * size, to: page * size - 1 };
}

export type TimelineStep = { label: string; at: string };

/** The run's own timestamps in order, for the detail view. */
export function timeline(run: {
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  status: string;
}): TimelineStep[] {
  const steps: TimelineStep[] = [{ label: 'Queued', at: run.queuedAt }];
  if (run.startedAt) steps.push({ label: 'Started', at: run.startedAt });
  if (run.finishedAt) steps.push({ label: statusLabel(run.status), at: run.finishedAt });
  return steps;
}
