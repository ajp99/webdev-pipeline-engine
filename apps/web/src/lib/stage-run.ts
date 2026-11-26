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
  const proto = prototypeView(content);
  if (proto) {
    return [
      { title: 'What the agent did', markdown: proto.summary },
      {
        title: 'Where it is',
        markdown: `Main page (/), commit ${proto.commit.slice(0, 8)} on the local staging branch. Claims for the client to confirm: ${proto.claims}.`,
      },
      { title: 'Skills used', markdown: proto.skills.join(', ') || 'none' },
    ];
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

export type PrototypeView = {
  summary: string;
  commit: string;
  claims: number;
  skills: string[];
  screenshots: { desktop: string; mobile: string };
};

/** A prototype artifact (P3-T04) as the console shows it, or null when the content is not one. */
export function prototypeView(content: unknown): PrototypeView | null {
  const c = content as Partial<PrototypeView> & { branch?: unknown; page?: unknown };
  if (typeof content !== 'object' || content === null || c.page !== '/' || c.branch !== 'staging')
    return null;
  const shots = c.screenshots as { desktop?: unknown; mobile?: unknown } | undefined;
  if (typeof c.summary !== 'string' || typeof c.commit !== 'string' || typeof c.claims !== 'number')
    return null;
  if (typeof shots?.desktop !== 'string' || typeof shots?.mobile !== 'string') return null;
  return {
    summary: c.summary,
    commit: c.commit,
    claims: c.claims,
    skills: Array.isArray(c.skills)
      ? c.skills.filter((x): x is string => typeof x === 'string')
      : [],
    screenshots: { desktop: shots.desktop, mobile: shots.mobile },
  };
}

type Line = { file: string; text: string };
export type RoundView = {
  round: number;
  title: string;
  branch: string;
  commit: string;
  summary: string;
  files: { path: string; added: number; removed: number }[];
  notesDiff: string;
  screenshots: { desktop: string; mobile: string };
  claims: Line[];
  claimsToCheck: Line[];
  unmarkedClaims: Line[];
  packages: { name: string; from: string | null; to: string | null; install_scripts: boolean }[];
  backlog: { questions: number; assumptions: number; refused: number };
  readerFlags: string[];
  feedbackVersion: boolean;
};

const lines = (v: unknown): Line[] =>
  Array.isArray(v)
    ? v.flatMap((x) =>
        x && typeof x === 'object' && typeof x.file === 'string' && typeof x.text === 'string'
          ? [{ file: x.file, text: x.text }]
          : [],
      )
    : [];
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** A round summary as the worker writes it (P4-T06), or null when the content is not one. */
export function roundView(content: unknown): RoundView | null {
  if (typeof content !== 'object' || content === null) return null;
  const c = content as Record<string, unknown>;
  const shots = c.screenshots as { desktop?: unknown; mobile?: unknown } | undefined;
  if (!Number.isInteger(c.round) || typeof c.branch !== 'string' || typeof c.commit !== 'string')
    return null;
  if (typeof shots?.desktop !== 'string' || typeof shots?.mobile !== 'string') return null;
  const b = (c.backlog ?? {}) as Record<string, unknown>;
  return {
    round: c.round as number,
    title: typeof c.title === 'string' ? c.title : '',
    branch: c.branch,
    commit: c.commit,
    summary: typeof c.summary === 'string' ? c.summary : '',
    files: Array.isArray(c.files)
      ? c.files.flatMap((f) =>
          f && typeof f.path === 'string'
            ? [{ path: f.path, added: num(f.added), removed: num(f.removed) }]
            : [],
        )
      : [],
    notesDiff: typeof c.notes_diff === 'string' ? c.notes_diff : '',
    screenshots: { desktop: shots.desktop, mobile: shots.mobile },
    claims: lines(c.claims),
    claimsToCheck: lines(c.claims_to_check),
    unmarkedClaims: lines(c.unmarked_claims),
    packages: Array.isArray(c.packages)
      ? c.packages.flatMap((p) =>
          p && typeof p.name === 'string'
            ? [
                {
                  name: p.name,
                  from: typeof p.from === 'string' ? p.from : null,
                  to: typeof p.to === 'string' ? p.to : null,
                  install_scripts: p.install_scripts === true,
                },
              ]
            : [],
        )
      : [],
    backlog: {
      questions: num(b.questions),
      assumptions: num(b.assumptions),
      refused: num(b.refused),
    },
    readerFlags: strings(c.reader_flags),
    feedbackVersion: c.feedback_version === true,
  };
}

/** Tokens used against the plan's budget, as a share from 0 to 1 (P4-T10). No money, no warnings. */
export function tokenShare(used: number, budget: number): number {
  if (!(budget > 0) || !(used > 0)) return 0;
  return Math.min(1, used / budget);
}
