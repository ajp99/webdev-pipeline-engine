// Rules for running a stage from the console (P2-T23). Pure, so they can be tested.

/** The stages the walking skeleton has a handler for; the Run button shows only on these. */
export const RUNNABLE_STAGES = ['requirements', 'plan', 'prototype', 'build_rounds'] as const;

export function isRunnable(stage: string): boolean {
  return (RUNNABLE_STAGES as readonly string[]).includes(stage);
}

/** The artifact type each stub stage writes. */
export const STAGE_ARTIFACT: Record<string, string> = {
  requirements: 'prd',
  plan: 'plan',
  prototype: 'prototype',
};

export type RunGate = {
  stage: string;
  status: string;
  hasOpenRun: boolean;
  /** The newest artifact of the stage's type is already approved (the stage is waiting to advance). */
  newestApproved?: boolean;
};

/** Why Run is not offered, or null when it is. The database still decides (enqueue_run). */
export function runBlocked(g: RunGate): string | null {
  if (g.status !== 'active') return `The project is ${g.status}.`;
  if (!isRunnable(g.stage)) return `The ${g.stage.replace('_', ' ')} stage has no runner yet.`;
  if (g.hasOpenRun) return 'A run is already queued or running for this project.';
  if (g.newestApproved)
    return `The ${STAGE_ARTIFACT[g.stage] ?? 'artifact'} is already approved; advance the project instead.`;
  return null;
}

/**
 * The preview address the Builder logged ("Preview: http://localhost:4100"), newest line first. Only a
 * localhost address counts, so a line that quotes other text can never become a link.
 */
export function previewUrl(messages: string[]): string | null {
  for (const m of messages) {
    const hit = /^Preview: (http:\/\/localhost:[0-9]{2,5}\/?)\s*$/.exec(m);
    if (hit) return hit[1]!;
  }
  return null;
}

export type Section = { title: string; markdown: string };

/** The readable sections of a stub or real artifact: its `sections` list, or null when it has none. */
export function artifactSections(content: unknown): Section[] | null {
  if (typeof content !== 'object' || content === null) return null;
  const list = (content as { sections?: unknown }).sections;
  if (!Array.isArray(list) || list.length === 0) return null;
  const out: Section[] = [];
  for (const s of list) {
    if (typeof s !== 'object' || s === null) return null;
    const { title, markdown } = s as { title?: unknown; markdown?: unknown };
    if (typeof title !== 'string' || typeof markdown !== 'string') return null;
    out.push({ title, markdown });
  }
  return out;
}
