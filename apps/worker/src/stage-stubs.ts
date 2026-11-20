// Stub stage agents for the walking skeleton (P2-T23). The requirements, plan and prototype stages each
// write a short deterministic artifact built from the one before, with no model call, so the stage path,
// the gates and the console can be proven end to end. The real agents (P2-T07 and later) replace these.
import {
  asPrd,
  intakeData,
  PRD_SECTIONS,
  type PrdContent,
  type PrdNotes,
  type ReviewInput,
} from '@wpe/shared';
import type { Handler } from './runner';

export type StubType = 'prd' | 'plan' | 'prototype';
export type Section = { title: string; markdown: string };
export type StubContent = { stub: true; sections: Section[] };

/** The stage each stub writes for, and the artifact type it writes. */
export const STUB_FOR_STAGE: Record<string, StubType> = {
  requirements: 'prd',
  plan: 'plan',
  prototype: 'prototype',
};

export interface StubDeps {
  /** The project's name and its intake as the review model sees it, or null when there is none. */
  loadIntake(projectId: string): Promise<{ projectName: string; input: ReviewInput } | null>;
  /** The newest approved artifact of a type, or null when none is approved. */
  loadApproved(projectId: string, type: 'prd' | 'plan'): Promise<unknown | null>;
  /** complete_stage_artifact: writes the next draft version for this run (a PRD also writes its notes). */
  write(a: {
    project: string;
    run: string;
    worker: string;
    type: StubType;
    content: StubContent | PrdContent;
    notes?: PrdNotes;
  }): Promise<void>;
}

const MAX_CONTENT_CHARS = 95_000;
const MAX_ANSWER_CHARS = 2000;
const cut = (s: string) => (s.length > MAX_ANSWER_CHARS ? `${s.slice(0, MAX_ANSWER_CHARS)}…` : s);

/**
 * A PRD in the stored shape (D-325) built from the intake with no model: the answered questions go into the
 * content inventory, the site map is the one page plus the two required notices. Deterministic.
 */
export function buildStubPrd(projectName: string, input: ReviewInput): PrdContent {
  const data = intakeData(input);
  const answers: string[] = [];
  for (const s of data.sections) {
    const lines = s.questions
      .filter((q) => q.answer !== null)
      .map((q) => {
        const a = Array.isArray(q.answer) ? q.answer.join(', ') : String(q.answer);
        return `- ${q.question}: ${cut(a)}`;
      });
    if (lines.length > 0) answers.push(`### ${s.title}\n\n${lines.join('\n')}`);
  }
  for (const h of data.follow_up_history.filter((f) => f.answer)) {
    answers.push(`### Follow-up ${h.id}\n\n- ${h.question}: ${cut(h.answer!)}`);
  }
  return {
    sections: {
      business:
        `Product requirements for ${projectName}, built from the intake answers by a stub, ` +
        `not by the requirements agent. Industry: ${data.industry}.`,
      site_map: '- Home (/)\n- Privacy policy\n- Cookie notice',
      features: '- Contact form (Must)',
      content: answers.length > 0 ? answers.join('\n\n') : 'No intake answers yet.',
      brand: 'Taken from the intake (stub).',
      non_functional: 'Lighthouse 80+, basic SEO, responsive, accessibility basics.',
    },
    spam_protection: 'honeypot',
    change_summary: 'Stub draft built from the intake.',
  };
}

export const STUB_PRD_NOTES: PrdNotes = { gaps: [], conflicts: [] };

function sectionsOf(content: unknown): Section[] {
  const list = (content as { sections?: unknown } | null)?.sections;
  if (!Array.isArray(list)) return [];
  return list.filter(
    (s): s is Section =>
      typeof s === 'object' &&
      s !== null &&
      typeof (s as Section).title === 'string' &&
      typeof (s as Section).markdown === 'string',
  );
}

/** A one-page plan that lists the approved PRD's sections as the page's content. */
export function buildStubPlan(prd: unknown): StubContent {
  if (!asPrd(prd)) throw new Error('the approved PRD has no sections to plan from');
  const titles = PRD_SECTIONS.map((s) => s.title);
  return {
    stub: true,
    sections: [
      {
        title: 'Pages (stub)',
        markdown: `One page, "/" (Home). It covers: ${titles.join('; ')}.`,
      },
      {
        title: 'Build notes (stub)',
        markdown: 'Single page, Next.js and Tailwind starter, no extra dependencies.',
      },
    ],
  };
}

/** A prototype note that restates the approved plan; the real Prototype agent adds screenshots. */
export function buildStubPrototype(plan: unknown): StubContent {
  const pages = sectionsOf(plan).find((s) => s.title.startsWith('Pages'));
  if (!pages) throw new Error('the approved plan has no pages section to prototype from');
  return {
    stub: true,
    sections: [
      {
        title: 'Prototype (stub)',
        markdown: `No screenshots yet (stub). Planned: ${pages.markdown}`,
      },
    ],
  };
}

export function stubStageHandler(deps: StubDeps): Handler {
  return async ({ run, worker, signal, progress, log }) => {
    const type = STUB_FOR_STAGE[run.stage];
    if (!type) throw new Error(`no stub for stage ${run.stage}`);
    progress();
    let content: StubContent | PrdContent;
    if (type === 'prd') {
      const intake = await deps.loadIntake(run.project_id);
      if (!intake) throw new Error('the project has no intake to build the PRD from');
      content = buildStubPrd(intake.projectName, intake.input);
    } else if (type === 'plan') {
      const prd = await deps.loadApproved(run.project_id, 'prd');
      if (!prd) throw new Error('there is no approved PRD to plan from');
      content = buildStubPlan(prd);
    } else {
      const plan = await deps.loadApproved(run.project_id, 'plan');
      if (!plan) throw new Error('there is no approved plan to prototype from');
      content = buildStubPrototype(plan);
    }
    // The database refuses content over 100000 characters; say so plainly here.
    if (JSON.stringify(content).length > MAX_CONTENT_CHARS)
      throw new Error('the intake is too long for a stub PRD (over the 100000 character limit)');
    // A cancel that arrived while this ran wins: nothing is written.
    if (signal.aborted) throw new Error('stopped');
    await deps.write({
      project: run.project_id,
      run: run.id,
      worker,
      type,
      content,
      ...(type === 'prd' ? { notes: STUB_PRD_NOTES } : {}),
    });
    log('info', `wrote a stub ${type} (${Object.keys(content.sections).length} sections)`);
    progress();
    return { tokens: 0 };
  };
}
