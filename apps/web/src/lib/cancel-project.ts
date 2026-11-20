// Cancel project in the owner console (P2-T20, D-237, D-268): the owner types the project's name and gives a
// reason. Pure rules, tested; the database re-checks the state and the reason (cancel_project).
export const MAX_CANCEL_REASON_CHARS = 2000;

/** Null when the project can be cancelled: it is open (active or paused) and before handover. */
export function cancelBlocked(status: string, stage: string): string | null {
  if (status === 'closed') return 'This project is already closed.';
  if (stage === 'handover' || stage === 'closed')
    return 'This project is at handover. It ends through the handover gate, not by cancelling.';
  return null;
}

/**
 * Null when the form is good to send, else what to fix. The typed name must match the project's name
 * exactly (case and inner spaces included; leading and trailing spaces are ignored), so a slip does not
 * cancel the wrong project.
 */
export function cancelProblem(projectName: string, typed: string, reason: string): string | null {
  if (typed.trim() !== projectName) return `Type the project name exactly: ${projectName}`;
  const why = reason.trim();
  if (why === '') return 'Write the reason first.';
  if (why.length > MAX_CANCEL_REASON_CHARS)
    return `The reason has at most ${MAX_CANCEL_REASON_CHARS} characters.`;
  return null;
}
