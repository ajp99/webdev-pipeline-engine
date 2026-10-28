import type { QueueItem } from '@wpe/shared';
import { acceptGate, rejectGate, sendFeedback } from '@/app/owner/queue/actions';

const FEEDBACK_MAX = 10_000;

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
        <form action={rejectGate}>
          <input type="hidden" name="projectId" value={item.projectId} />
          <input type="hidden" name="artifactId" value={item.artifactId ?? ''} />
          <button
            type="submit"
            disabled={!item.canReject}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Reject
          </button>
        </form>
        {reason ? <span className="text-sm text-neutral-500">{reason}</span> : null}
      </div>
      {item.round === null && item.feedbackCap > 0 ? (
        <div className="mt-3 text-sm">
          {item.canFeedback ? (
            <details>
              <summary className="cursor-pointer text-neutral-700">
                Feedback ({item.feedbackUsed} of {item.feedbackCap} used)
              </summary>
              <form action={sendFeedback} className="mt-2 flex flex-col gap-2">
                <input type="hidden" name="projectId" value={item.projectId} />
                <input type="hidden" name="artifactId" value={item.artifactId ?? ''} />
                <label htmlFor={`fb-${item.key}`} className="text-neutral-600">
                  Notes for the agent
                </label>
                <textarea
                  id={`fb-${item.key}`}
                  name="body"
                  required
                  maxLength={FEEDBACK_MAX}
                  rows={4}
                  className="rounded border border-neutral-300 p-2"
                />
                <button
                  type="submit"
                  className="self-start rounded border border-neutral-300 px-3 py-1.5"
                >
                  Send feedback
                </button>
              </form>
            </details>
          ) : item.canReject && item.feedbackUsed >= item.feedbackCap ? (
            <p className="text-neutral-500">
              Feedback used up ({item.feedbackUsed} of {item.feedbackCap}): accept or reject this
              version.
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
