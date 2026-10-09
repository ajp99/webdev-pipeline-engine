// What is waiting for the owner (P1-T06). Pure functions over rows read from the database.
import type { Stage } from './index';
import { STAGES } from './index';

const STAGE_ORDER: readonly Stage[] = STAGES;

export type GateType = 'soft' | 'hard' | 'client';

export type QueueProject = {
  id: string;
  name: string;
  stage: Stage;
  status: 'active' | 'paused' | 'closed';
};
export type QueueGateConfig = {
  stage: Stage;
  project_id: string | null;
  gate_type: GateType;
  gatekeeper: string;
  escalate_after_hours: number;
};
export type QueueArtifact = {
  id: string;
  project_id: string;
  type: string;
  version: number;
  status: 'draft' | 'approved' | 'superseded';
  created_at: string;
  /** For round_summary artifacts: the round the summary belongs to (content.round). */
  round?: number | null;
};
export type QueueApproval = { artifact_id: string; gate_type: GateType; at: string };
export type QueueRound = { project_id: string; number: number; status: string };

export type QueueInput = {
  now: Date;
  projects: QueueProject[];
  gateConfig: QueueGateConfig[];
  artifacts: QueueArtifact[];
  approvals: QueueApproval[];
  rounds: QueueRound[];
};

export type QueueItem = {
  key: string;
  projectId: string;
  projectName: string;
  stage: Stage;
  gateType: GateType;
  gatekeeper: string;
  /** The owner can act on it now: an owner gate whose earlier gates are already approved. */
  actionable: boolean;
  artifactId: string | null;
  artifactType: string;
  round: number | null;
  since: string;
  hoursWaiting: number;
  escalateAfterHours: number;
  overdue: boolean;
};

export type ReadyToAdvance = { project: QueueProject; nextStage: Stage };

export type Queue = {
  items: QueueItem[];
  waitingForAgent: QueueProject[];
  ready: ReadyToAdvance[];
};

/**
 * Which artifact type's approvals gate each stage. Must match the CASE in advance_stage()
 * (migration 0002); a test compares the two.
 */
export const STAGE_ARTIFACT: Partial<Record<Stage, string>> = {
  intake: 'intake_record',
  requirements: 'prd',
  plan: 'plan',
  prototype: 'prototype',
  qc_report: 'report',
  deploy_prep: 'deployment_checklist',
  handover: 'handover_guide',
};
export const ROUND_ARTIFACT = 'round_summary';

const GATE_ORDER: GateType[] = ['soft', 'hard', 'client'];

type PendingGate = Omit<QueueItem, 'key' | 'projectName' | 'hoursWaiting' | 'overdue'>;

/** The newest summary of one round (Feedback makes a new version of the same round's summary). */
function latestRoundSummary(artifacts: QueueArtifact[], projectId: string, round: number) {
  const mine = artifacts
    .filter((a) => a.project_id === projectId && a.type === ROUND_ARTIFACT && a.round === round)
    .sort((a, b) => b.version - a.version);
  const top = mine[0];
  return top && top.status !== 'superseded' ? top : null;
}

function latest(artifacts: QueueArtifact[], projectId: string, type: string) {
  const mine = artifacts
    .filter((a) => a.project_id === projectId && a.type === type)
    .sort((a, b) => b.version - a.version);
  const top = mine[0];
  return top && top.status !== 'superseded' ? top : null;
}

/** The gate types required for a stage, global defaults plus the project's own rows (a project row wins). */
function requiredGates(input: QueueInput, project: QueueProject) {
  const byType = new Map<GateType, QueueGateConfig>();
  for (const g of input.gateConfig)
    if (g.stage === project.stage && g.project_id === null) byType.set(g.gate_type, g);
  for (const g of input.gateConfig)
    if (g.stage === project.stage && g.project_id === project.id) byType.set(g.gate_type, g);
  return GATE_ORDER.filter((t) => byType.has(t)).map((t) => byType.get(t)!);
}

/** Every gate of the project's current stage that has no approval yet, in the order they must be passed. */
function unapprovedGates(
  input: QueueInput,
  project: QueueProject,
): { gates: PendingGate[]; waitingForAgent: boolean; artifactReady: boolean } {
  if (project.status !== 'active')
    return { gates: [], waitingForAgent: false, artifactReady: false };

  if (project.stage === 'build_rounds') {
    const cfg = requiredGates(input, project)[0];
    const reviewing = input.rounds.filter(
      (r) => r.project_id === project.id && r.status === 'in_review',
    );
    const gates = reviewing.map((r): PendingGate => {
      const a = latestRoundSummary(input.artifacts, project.id, r.number);
      return {
        projectId: project.id,
        stage: project.stage,
        gateType: 'soft',
        gatekeeper: cfg?.gatekeeper ?? 'owner',
        actionable: a !== null,
        artifactId: a?.id ?? null,
        artifactType: ROUND_ARTIFACT,
        round: r.number,
        since: a?.created_at ?? input.now.toISOString(),
        escalateAfterHours: cfg?.escalate_after_hours ?? 24,
      };
    });
    return { gates, waitingForAgent: gates.length === 0, artifactReady: false };
  }

  const type = STAGE_ARTIFACT[project.stage];
  if (!type) return { gates: [], waitingForAgent: false, artifactReady: false };
  const art = latest(input.artifacts, project.id, type);
  if (!art) return { gates: [], waitingForAgent: true, artifactReady: false };

  const approvals = input.approvals.filter((a) => a.artifact_id === art.id);
  const gates: PendingGate[] = [];
  let since = art.created_at;
  let earlierPending = false;
  for (const cfg of requiredGates(input, project)) {
    const done = approvals.filter((a) => a.gate_type === cfg.gate_type);
    if (done.length > 0) {
      for (const d of done) if (d.at > since) since = d.at;
      continue;
    }
    gates.push({
      projectId: project.id,
      stage: project.stage,
      gateType: cfg.gate_type,
      gatekeeper: cfg.gatekeeper,
      actionable: cfg.gatekeeper === 'owner' && !earlierPending,
      artifactId: art.id,
      artifactType: type,
      round: null,
      since,
      escalateAfterHours: cfg.escalate_after_hours,
    });
    earlierPending = true;
  }
  return { gates, waitingForAgent: false, artifactReady: gates.length === 0 };
}

/** The unapproved gates of one project's current stage (used after Accept to decide whether to advance). */
export function remainingGates(input: QueueInput, projectId: string): PendingGate[] {
  const project = input.projects.find((p) => p.id === projectId);
  return project ? unapprovedGates(input, project).gates : [];
}

export function buildQueue(input: QueueInput): Queue {
  const items: QueueItem[] = [];
  const waitingForAgent: QueueProject[] = [];
  const ready: ReadyToAdvance[] = [];
  for (const project of input.projects) {
    const { gates, waitingForAgent: waiting, artifactReady } = unapprovedGates(input, project);
    if (waiting) waitingForAgent.push(project);
    // Every gate of the stage is approved but the project has not moved: the owner advances it.
    const nextStage = STAGE_ORDER[STAGE_ORDER.indexOf(project.stage) + 1];
    if (artifactReady && nextStage) ready.push({ project, nextStage });
    // Only the next gate to pass is shown; the ones behind it appear once it is approved.
    const shown = project.stage === 'build_rounds' ? gates : gates.slice(0, 1);
    for (const g of shown) {
      const hoursWaiting = (input.now.getTime() - new Date(g.since).getTime()) / 3_600_000;
      items.push({
        ...g,
        key: `${g.projectId}:${g.stage}:${g.gateType}:${g.round ?? ''}`,
        projectName: project.name,
        hoursWaiting,
        overdue: hoursWaiting > g.escalateAfterHours,
      });
    }
  }
  items.sort((a, b) => b.hoursWaiting - a.hoursWaiting);
  return { items, waitingForAgent, ready };
}
