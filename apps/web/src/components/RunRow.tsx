import { cancelRun } from '@/app/owner/runs/actions';
import { canCancel, durationLabel, statusLabel, type RunRowData } from '../lib/runs';

const STATUS_STYLE: Record<string, string> = {
  queued: 'bg-neutral-100 text-neutral-700',
  running: 'bg-sky-100 text-sky-800',
  waiting: 'bg-amber-100 text-amber-900',
  cancel_requested: 'bg-amber-100 text-amber-900',
  succeeded: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-neutral-100 text-neutral-700',
  stopped: 'bg-red-100 text-red-800',
};

export function RunRow({ run, now }: { run: RunRowData; now: Date }) {
  return (
    <tr className="border-t border-neutral-200">
      <td className="py-2 font-medium">{run.projectName}</td>
      <td>
        {run.stage.replace('_', ' ')}
        {run.model === 'stub' ? (
          <span className="ml-1 text-xs text-neutral-500">(stub)</span>
        ) : null}
      </td>
      <td>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[run.status] ?? ''}`}
        >
          {statusLabel(run.status)}
        </span>
      </td>
      <td>{run.attempts}</td>
      <td>{durationLabel(run.startedAt, run.finishedAt, now)}</td>
      <td>{run.tokensUsed}</td>
      <td>
        {canCancel(run.status) ? (
          <form action={cancelRun}>
            <input type="hidden" name="runId" value={run.id} />
            <button type="submit" className="rounded border border-neutral-400 px-2 py-1 text-xs">
              Cancel
            </button>
          </form>
        ) : null}
      </td>
    </tr>
  );
}
