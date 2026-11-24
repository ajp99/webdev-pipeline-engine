// One build round run (P4-T01, P4-T04, D-332): picks the round, merges rounds the owner accepted into staging,
// reads the client's content through the reader stage (P4-T13), runs the Builder on the round's `round-N` branch
// with the allowlist and owner pauses (P4-T02, P4-T03), runs the checks, logs the backlog, commits, takes
// screenshots of the local preview and writes the round summary for the owner's review. A blocker stops the round
// before review. Disk, git, child processes, the SDK, the browser and the database are injected, so the order of
// steps and the failure rules are tested without them.
import {
  buildRoundPrompt,
  builderView,
  planProblem,
  ROUND_BACKLOG_FILE,
  type Plan,
  type PlanRound,
  type ReaderFields,
  type ReaderInput,
  type Skill,
} from '@wpe/shared';
import type { RunIo } from './builder';
import { promptHash } from './prompt-hash';
import { builderModel, type RoundGateDeps, type RoundSession } from './round-builder';
import type { Handler } from './runner';
import type { Screens } from './prototype';

export type RoundStatus = 'planned' | 'building' | 'in_review' | 'approved';
export type RoundRow = { number: number; status: RoundStatus; merged: boolean };

export type RoundLoad = {
  projectName: string;
  plan: Plan;
  rounds: RoundRow[];
  /** The owner's Feedback on a round in review that has not been answered by a new version yet. */
  feedback: { round: number; notes: string[] } | null;
  /** The owner's answers to the Builder's backlog questions (owner text, not client text). */
  ownerAnswers: string[];
  reader: ReaderInput;
  /** Skill bodies by id, from the library (D-260). */
  skills: Skill[];
  /** Package names the plan or the curated allowlist allows (D-286). */
  allowedPackages: string[];
};

export type BacklogEntry = {
  kind: 'question' | 'assumption' | 'blocker';
  question: string;
  options: string;
  assumption: string;
};

export type RoundSummaryContent = {
  round: number;
  title: string;
  branch: string;
  commit: string;
  base: 'staging';
  files: { path: string; added: number; removed: number }[];
  notes_diff: string;
  screenshots: { desktop: string; mobile: string };
  summary: string;
  skills: string[];
  /** The <Claim> markers on the round's pages, for the owner to confirm (P4-T05, D-143). */
  claims: { file: string; text: string }[];
  backlog: { questions: number; assumptions: number; refused: number };
  /** What the reader stage kept away from the Builder, for the owner (D-267). */
  reader_flags: string[];
  feedback_version: boolean;
};

export interface RoundDeps {
  load(projectId: string): Promise<RoundLoad | null>;
  read(input: ReaderInput, io: RunIo): Promise<{ fields: ReaderFields; tokens: number }>;
  prepare(projectId: string, io: RunIo): Promise<string>;
  stopPreview(dir: string): Promise<void>;
  /** Merges an accepted round's branch into staging with a merge commit, unless it is already merged (D-332). */
  merge(dir: string, round: number, io: RunIo): Promise<string>;
  recordMerge(projectId: string, round: number, commit: string): Promise<void>;
  /** Creates round-N from staging, or switches to it for a Feedback version or a retry. */
  branch(dir: string, name: string, io: RunIo): Promise<void>;
  startRound(projectId: string, round: PlanRound, branch: string): Promise<void>;
  session: RoundSession;
  refused(a: {
    project: string;
    run: string;
    round: number;
    command: string;
    reason: string;
  }): Promise<void>;
  askOwner(runId: string, signal: AbortSignal): RoundGateDeps['askOwner'];
  checks(dir: string, io: RunIo): Promise<void>;
  /** Reads and removes the Builder's backlog file; '' when there is none. */
  takeBacklog(dir: string): Promise<string>;
  logBacklog(a: {
    project: string;
    run: string;
    round: number;
    entries: BacklogEntry[];
  }): Promise<void>;
  claims(dir: string): Promise<{ file: string; text: string }[]>;
  commit(dir: string, io: RunIo, message: string): Promise<string>;
  diff(dir: string): Promise<{ files: RoundSummaryContent['files']; notes: string }>;
  startPreview(dir: string, io: RunIo): Promise<string>;
  screenshots(url: string, io: RunIo): Promise<Screens>;
  store(
    projectId: string,
    key: string,
    screens: Screens,
  ): Promise<{ desktop: string; mobile: string }>;
  /** Writes the round summary and sets the round in review. */
  write(a: {
    project: string;
    run: string;
    worker: string;
    content: RoundSummaryContent;
    model: string;
    promptHash: string;
  }): Promise<void>;
}

export type NextRound = { round: PlanRound; why: 'feedback' | 'retry' | 'next' };

/**
 * Which round this run works on (P4-T01): the round the owner gave Feedback on; else a round left building by a
 * failed or blocked run; else, when nothing is in review, the first planned round whose dependencies are all
 * approved. A round never starts while another is in review or before the rounds it depends on are approved.
 */
export function nextRound(
  plan: Plan,
  rows: RoundRow[],
  feedback: RoundLoad['feedback'],
): NextRound | null {
  const byNo = new Map(rows.map((r) => [r.number, r]));
  const planned = (n: number) => plan.rounds.find((r) => r.number === n);
  if (feedback) {
    const r = planned(feedback.round);
    if (r && byNo.get(r.number)?.status === 'in_review') return { round: r, why: 'feedback' };
  }
  const building = rows
    .filter((r) => r.status === 'building')
    .sort((a, b) => a.number - b.number)[0];
  if (building) {
    const r = planned(building.number);
    return r ? { round: r, why: 'retry' } : null;
  }
  if (rows.some((r) => r.status === 'in_review')) return null;
  for (const r of [...plan.rounds].sort((a, b) => a.number - b.number)) {
    const st = byNo.get(r.number)?.status ?? 'planned';
    if (st !== 'planned') continue;
    return r.depends_on.every((d) => byNo.get(d)?.status === 'approved')
      ? { round: r, why: 'next' }
      : null;
  }
  return null;
}

const KINDS = new Set(['question', 'assumption', 'blocker']);
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

/** The Builder's backlog file, checked: at most 50 entries, known kinds, a question each. Bad entries are dropped. */
export function parseBacklog(text: string): { entries: BacklogEntry[]; problem: string | null } {
  if (!text.trim()) return { entries: [], problem: null };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { entries: [], problem: `${ROUND_BACKLOG_FILE} is not valid JSON` };
  }
  if (!Array.isArray(raw)) return { entries: [], problem: `${ROUND_BACKLOG_FILE} is not a list` };
  const entries: BacklogEntry[] = [];
  let dropped = 0;
  for (const e of raw.slice(0, 50)) {
    const o = (e ?? {}) as Record<string, unknown>;
    const q = clip(o.question, 2000);
    if (!KINDS.has(o.kind as string) || !q) {
      dropped++;
      continue;
    }
    entries.push({
      kind: o.kind as BacklogEntry['kind'],
      question: q,
      options: clip(o.options, 2000),
      assumption: clip(o.assumption, 2000),
    });
  }
  const over = raw.length > 50 ? raw.length - 50 : 0;
  return {
    entries,
    problem:
      dropped || over
        ? `${dropped + over} backlog entries were dropped (no question, unknown kind or over 50)`
        : null,
  };
}

export function roundHandler(deps: RoundDeps): Handler {
  return async ({ run, worker, signal, progress, log }) => {
    const io: RunIo = { signal, progress, log };
    progress();
    const input = await deps.load(run.project_id);
    if (!input) {
      log('info', 'nothing to build: the project is no longer in build rounds');
      return { tokens: 0 };
    }
    if (planProblem(input.plan) !== null)
      throw new Error('the approved plan is not in its stored shape');
    const dir = await deps.prepare(run.project_id, io);
    await deps.stopPreview(dir);

    // D-332: rounds the owner accepted are merged into staging before anything else.
    for (const r of input.rounds
      .filter((x) => x.status === 'approved' && !x.merged)
      .sort((a, b) => a.number - b.number)) {
      const commit = await deps.merge(dir, r.number, io);
      await deps.recordMerge(run.project_id, r.number, commit);
      log('info', `merged round ${r.number} into staging (${commit.slice(0, 8)})`);
      r.merged = true;
    }

    const next = nextRound(input.plan, input.rounds, input.feedback);
    if (!next) {
      log(
        'info',
        'no round to build now: one is in review, the next waits for its dependencies, or all are done',
      );
      return { tokens: 0 };
    }
    const { round } = next;
    const branch = `round-${round.number}`;
    await deps.branch(dir, branch, io);
    await deps.startRound(run.project_id, round, branch);
    log('info', `round ${round.number} (${next.why}): ${round.title}`);

    // P4-T13: the Builder sees only the reader's fields; the flags go to the owner in the summary.
    const reader = await deps.read(input.reader, io);
    const skills = input.skills.filter((s) => round.skills.includes(s.id));
    const { system, user } = buildRoundPrompt({
      projectName: input.projectName,
      round,
      designBrief: input.plan.design_brief,
      client: builderView(reader.fields),
      ownerNotes: [
        ...(next.why === 'feedback' ? (input.feedback?.notes ?? []) : []),
        ...input.ownerAnswers,
      ],
      skills: skills.map((s) => ({ name: s.id, body: s.body })),
    });

    let refused = 0;
    const gate: RoundGateDeps = {
      dir,
      commands: { allowedPackages: new Set(input.allowedPackages), roundBranch: branch },
      refused: async (command, reason) => {
        refused++;
        await deps.refused({
          project: run.project_id,
          run: run.id,
          round: round.number,
          command,
          reason,
        });
      },
      askOwner: deps.askOwner(run.id, signal),
      log: (level, msg) => log(level, msg),
    };
    const model = builderModel(round.hard);
    const result = await deps.session({ gate, system, prompt: user, model, signal, progress });
    if (signal.aborted) throw new Error('stopped');
    log('info', `Builder: ${result.summary.slice(0, 300)}`);

    const backlog = parseBacklog(await deps.takeBacklog(dir));
    if (backlog.problem) log('warn', backlog.problem);
    if (backlog.entries.length)
      await deps.logBacklog({
        project: run.project_id,
        run: run.id,
        round: round.number,
        entries: backlog.entries,
      });
    const blockers = backlog.entries.filter((e) => e.kind === 'blocker');
    if (blockers.length) {
      // The work so far is kept on the branch; the round waits for the owner instead of going to review.
      await deps.commit(dir, io, `Round ${round.number}: work so far (blocked)`);
      log(
        'warn',
        `round ${round.number} is blocked: ${blockers
          .map((b) => b.question)
          .join(' | ')
          .slice(0, 500)}`,
      );
      return { tokens: reader.tokens + result.tokens };
    }

    await deps.checks(dir, io);
    const claims = await deps.claims(dir);
    const commit = await deps.commit(dir, io, `Round ${round.number}: ${round.title}`);
    const diff = await deps.diff(dir);
    const url = await deps.startPreview(dir, io);
    log('info', `Preview: ${url}`);
    const screens = await deps.screenshots(url, io);
    const paths = await deps.store(
      run.project_id,
      `round-${round.number}-${commit.slice(0, 8)}`,
      screens,
    );
    if (signal.aborted) throw new Error('stopped');
    await deps.write({
      project: run.project_id,
      run: run.id,
      worker,
      model: result.model,
      promptHash: promptHash(system, { tools: 'round-builder-allowlist' }),
      content: {
        round: round.number,
        title: round.title,
        branch,
        commit,
        base: 'staging',
        files: diff.files.slice(0, 300),
        notes_diff: diff.notes.slice(0, 20_000),
        screenshots: paths,
        summary: result.summary.slice(0, 4000),
        skills: skills.map((s) => s.id),
        claims: claims.slice(0, 200),
        backlog: {
          questions: backlog.entries.filter((e) => e.kind === 'question').length,
          assumptions: backlog.entries.filter((e) => e.kind === 'assumption').length,
          refused,
        },
        reader_flags: reader.fields.flags,
        feedback_version: next.why === 'feedback',
      },
    });
    log('info', `round ${round.number} is ready for review (${commit.slice(0, 8)})`);
    progress();
    return { tokens: reader.tokens + result.tokens };
  };
}
