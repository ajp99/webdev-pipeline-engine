import type { QueueItem } from '@wpe/shared';
import { acceptGate } from '@/app/owner/queue/actions';

const TYPE_STYLE: Record<string, string> = {
  soft: 'bg-sky-100 text-sky-800',
  hard: 'bg-amber-100 text-amber-900',
  client: 'bg-violet-100 text-violet-800',
};

export function waitedLabel(hours: number): string {
  if (hours < 1) return 'under an hour';
  if (hours < 48) return `${Math.floor(hours)} h`;
  return `${Math.floor(hours / 24)} days`;
}

export function QueueItemCard({ item }: { item: QueueItem }) {
  const canAccept = item.actionable && item.round === null;
  const reason =
    item.round !== null
      ? 'Round review arrives in phase 4'
      : !item.actionable
        ? item.gatekeeper === 'client'
          ? 'Waiting for the client'
          : 'Waiting for the agent'
        : undefined;
  return (
    <li className="rounded border border-neutral-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{item.projectName}</span>
        <span className="text-sm text-neutral-600">
          {item.stage.replace('_', ' ')}
          {item.round !== null ? `, round ${item.round}` : ''}
        </span>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${TYPE_STYLE[item.gateType]}`}>
          {item.gateType} gate
        </span>
        {item.overdue ? (
          <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
            Overdue (limit {item.escalateAfterHours} h)
          </span>
        ) : null}
        <span className="ml-auto text-sm text-neutral-500">
          waiting {waitedLabel(item.hoursWaiting)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={acceptGate}>
          <input type="hidden" name="projectId" value={item.projectId} />
          <input type="hidden" name="artifactId" value={item.artifactId ?? ''} />
          <input type="hidden" name="gateType" value={item.gateType} />
          <button
            type="submit"
            disabled={!canAccept}
            title={reason}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            Accept
          </button>
        </form>
        <button
          type="button"
          disabled
          title="Sending notes back to the agent arrives in phase 2"
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Feedback
        </button>
        <button
          type="button"
          disabled
          title="Sending the stage back arrives in phase 2"
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Reject
        </button>
        {reason ? <span className="text-sm text-neutral-500">{reason}</span> : null}
      </div>
    </li>
  );
}
