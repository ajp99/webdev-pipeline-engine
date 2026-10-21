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
