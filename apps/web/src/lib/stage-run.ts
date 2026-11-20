// Rules for running a stage from the console (P2-T23). Pure, so they can be tested.
import {
  asPrd,
  planProblem,
  PRD_SECTIONS,
  prdNotesProblem,
  type Plan,
  type PrdNotes,
} from '@wpe/shared';

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

/**
 * The readable sections of an artifact: a PRD's fixed sections (D-325), the owner-only PRD notes, or a stub's
 * `sections` list; null when it has none.
 */
export function artifactSections(content: unknown): Section[] | null {
  const prd = asPrd(content);
  if (prd) {
    const out: Section[] = PRD_SECTIONS.map((s) => ({
      title: s.title,
      markdown: prd.sections[s.key],
    }));
    out.push({ title: 'Contact form spam protection', markdown: prd.spam_protection });
    if (prd.change_summary.trim())
      out.unshift({ title: 'What changed', markdown: prd.change_summary });
    return out;
  }
  if (planProblem(content) === null) {
    // The plan (P3-T03): the rounds the owner confirms at the soft gate (count, hard flags, budget), then the
    // design brief and the rationale.
    const p = content as Plan;
    const rounds = p.rounds
      .map(
        (r) =>
          `${r.number}. ${r.title}${r.hard ? ' (hard: stronger model)' : ''}\n   Scope: ${r.scope.join(', ')}\n   Skills: ${r.skills.join(', ') || 'none'}\n   Depends on: ${r.depends_on.length ? r.depends_on.join(', ') : 'nothing'}\n   Budget: ${r.token_budget.toLocaleString('en-GB')} tokens`,
      )
      .join('\n');
    return [
      {
        title: `Rounds (${p.rounds.length}; ${p.rounds.filter((r) => r.hard).length} hard)`,
        markdown: rounds,
      },
      {
        title: 'Total token budget',
        markdown: `${p.total_token_budget.toLocaleString('en-GB')} tokens`,
      },
      { title: 'Design brief: palette', markdown: p.design_brief.palette },
      { title: 'Design brief: fonts', markdown: p.design_brief.fonts },
      { title: 'Design brief: layout', markdown: p.design_brief.layout },
      { title: 'Design brief: references', markdown: p.design_brief.references },
      { title: 'Why these rounds', markdown: p.rationale.rounds },
      { title: 'Why these skills', markdown: p.rationale.skills },
      { title: 'Why this budget', markdown: p.rationale.budget },
      { title: 'Why this design', markdown: p.rationale.design },
    ];
  }
  if (prdNotesProblem(content) === null) {
    const n = content as PrdNotes;
    const list = (items: PrdNotes['gaps']) =>
      items.length === 0
        ? 'None.'
        : items.map((i) => `- ${i.issue}${i.resolution ? ` (${i.resolution})` : ''}`).join('\n');
    return [
      { title: 'Gaps (owner only)', markdown: list(n.gaps) },
      { title: 'Conflicts (owner only)', markdown: list(n.conflicts) },
    ];
  }
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
