// What is waiting for the owner (P1-T06, P2-T18). The gate rules live in the database (D-239):
// remaining_gates() returns one row per gate, and this file only arranges those rows for the console.
import type { Stage } from './stages';
import { STAGES } from './stages';

const STAGE_ORDER: readonly Stage[] = STAGES;

export type GateType = 'soft' | 'hard' | 'client';

export type QueueProject = {
  id: string;
  name: string;
  stage: Stage;
  status: 'active' | 'paused' | 'closed';
};
/** One row of remaining_gates() (D-261). */
export type GateRow = {
  project_id: string;
  stage: Stage;
  gate_type: GateType;
  gatekeeper: 'owner' | 'client';
  /** The build round, for the gates of build_rounds. */
  round: number | null;
  artifact_id: string | null;
  artifact_type: string;
  artifact_version: number | null;
  /** satisfied, missing (the next gate to pass), blocked (behind an earlier gate) or waiting (no artifact yet). */
  state: 'satisfied' | 'missing' | 'blocked' | 'waiting';
  since: string | null;
  due_at: string | null;
  overdue: boolean;
  /** The same on every row of a project: all its gates are approved and only Advance is left. */
  ready_to_advance: boolean;
};

export type QueueInput = {
  now: Date;
  projects: QueueProject[];
  gates: GateRow[];
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
 * The artifact type that gates each stage. The authority is private.stage_artifact() in the migration;
 * a test compares the two, and another checks the types against stages.yaml.
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

const HOUR = 3_600_000;

export function buildQueue(input: QueueInput): Queue {
  const items: QueueItem[] = [];
  const waitingForAgent: QueueProject[] = [];
  const ready: ReadyToAdvance[] = [];
  for (const project of input.projects) {
    if (project.status !== 'active') continue;
    const rows = input.gates.filter((g) => g.project_id === project.id);
    if (rows.length === 0) continue;
    if (rows.every((g) => g.state === 'waiting' && g.round === null)) waitingForAgent.push(project);
    // Every gate of the stage is approved but the project has not moved: the owner advances it.
    const nextStage = STAGE_ORDER[STAGE_ORDER.indexOf(project.stage) + 1];
    if (rows[0]!.ready_to_advance && nextStage) ready.push({ project, nextStage });
    // Only the next gate to pass is shown (the ones behind it appear once it is approved); a round
    // in review that has no summary yet is shown as waiting for the agent.
    for (const g of rows) {
      if (g.state !== 'missing' && !(g.state === 'waiting' && g.round !== null)) continue;
      const since = g.since ?? input.now.toISOString();
      const escalate =
        g.since && g.due_at ? (Date.parse(g.due_at) - Date.parse(g.since)) / HOUR : 24;
      const hoursWaiting = (input.now.getTime() - new Date(since).getTime()) / HOUR;
      items.push({
        key: `${g.project_id}:${g.stage}:${g.gate_type}:${g.round ?? ''}`,
        projectId: g.project_id,
        projectName: project.name,
        stage: g.stage,
        gateType: g.gate_type,
        gatekeeper: g.gatekeeper,
        actionable: g.state === 'missing' && g.gatekeeper === 'owner' && g.artifact_id !== null,
        artifactId: g.artifact_id,
        artifactType: g.artifact_type,
        round: g.round,
        since,
        hoursWaiting,
        escalateAfterHours: Math.round(escalate),
        overdue: g.overdue,
      });
    }
  }
  items.sort((a, b) => b.hoursWaiting - a.hoursWaiting);
  return { items, waitingForAgent, ready };
}
