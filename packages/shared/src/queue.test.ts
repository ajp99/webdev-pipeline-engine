import { describe, expect, it } from 'vitest';
import { buildQueue, type GateRow, type QueueInput, type QueueProject } from './queue';

const NOW = new Date('2026-10-08T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

const project = (over: Partial<QueueProject> = {}): QueueProject => ({
  id: 'p1',
  name: 'Dental',
  stage: 'plan',
  status: 'active',
  ...over,
});
const row = (over: Partial<GateRow> = {}): GateRow => ({
  project_id: 'p1',
  stage: 'plan',
  gate_type: 'soft',
  gatekeeper: 'owner',
  round: null,
  artifact_id: 'a1',
  artifact_type: 'plan',
  artifact_version: 1,
  state: 'missing',
  since: hoursAgo(5),
  due_at: new Date(NOW.getTime() + 19 * 3_600_000).toISOString(),
  overdue: false,
  ready_to_advance: false,
  artifact_status: 'draft',
  feedback_used: 0,
  feedback_cap: 3,
  ...over,
});
const input = (gates: GateRow[], projects: QueueProject[] = [project()]): QueueInput => ({
  now: NOW,
  projects,
  gates,
});

describe('buildQueue', () => {
  it('shows a missing owner gate as an actionable item with its wait and deadline', () => {
    const q = buildQueue(input([row()]));
    expect(q.items).toHaveLength(1);
    expect(q.items[0]).toMatchObject({
      key: 'p1:plan:soft:',
      projectName: 'Dental',
      gateType: 'soft',
      gatekeeper: 'owner',
      actionable: true,
      artifactId: 'a1',
      artifactType: 'plan',
      round: null,
      hoursWaiting: 5,
      escalateAfterHours: 24,
      overdue: false,
    });
    expect(q.ready).toEqual([]);
    expect(q.waitingForAgent).toEqual([]);
  });

  it('passes the overdue flag from the database, not its own clock', () => {
    const q = buildQueue(input([row({ overdue: true, since: hoursAgo(1) })]));
    expect(q.items[0]!.overdue).toBe(true);
  });

  it('shows a client gate that is missing as not actionable (the owner cannot accept it here)', () => {
    const q = buildQueue(
      input(
        [row({ stage: 'prototype', gate_type: 'client', gatekeeper: 'client' })],
        [project({ stage: 'prototype' })],
      ),
    );
    expect(q.items[0]).toMatchObject({ gatekeeper: 'client', actionable: false });
  });

  it('shows only the gate to pass next: blocked and satisfied gates stay hidden', () => {
    const q = buildQueue(
      input(
        [
          row({ stage: 'prototype', state: 'satisfied' }),
          row({ stage: 'prototype', gate_type: 'hard', state: 'missing' }),
          row({ stage: 'prototype', gate_type: 'client', gatekeeper: 'client', state: 'blocked' }),
        ],
        [project({ stage: 'prototype' })],
      ),
    );
    expect(q.items.map((i) => i.gateType)).toEqual(['hard']);
  });

  it('lists a project with no current artifact as waiting for the agent, with no item', () => {
    const q = buildQueue(
      input([row({ state: 'waiting', artifact_id: null, since: null, due_at: null })]),
    );
    expect(q.items).toEqual([]);
    expect(q.waitingForAgent.map((p) => p.id)).toEqual(['p1']);
  });

  it('lists a project whose gates are all approved under ready to advance, with its next stage', () => {
    const q = buildQueue(input([row({ state: 'satisfied', ready_to_advance: true })]));
    expect(q.items).toEqual([]);
    expect(q.ready).toEqual([{ project: project(), nextStage: 'prototype' }]);
  });

  it('does not list a project as ready when the database says it is not, even if every gate is approved', () => {
    const q = buildQueue(input([row({ state: 'satisfied', ready_to_advance: false })]));
    expect(q.ready).toEqual([]);
  });

  it('has no next stage to advance to after the last one', () => {
    const q = buildQueue(
      input(
        [row({ stage: 'closed' as never, state: 'satisfied', ready_to_advance: true })],
        [project({ stage: 'closed' })],
      ),
    );
    expect(q.ready).toEqual([]);
  });

  it('ignores paused and closed projects and projects with no rows', () => {
    const q = buildQueue(
      input(
        [row(), row({ project_id: 'p2' })],
        [
          project(),
          project({ id: 'p2', name: 'Paused', status: 'paused' }),
          project({ id: 'p3', name: 'Quiet' }),
        ],
      ),
    );
    expect(q.items.map((i) => i.projectId)).toEqual(['p1']);
    expect(q.waitingForAgent).toEqual([]);
  });

  it('shows every build round in review: one item per round, or waiting when it has no summary yet', () => {
    const q = buildQueue(
      input(
        [
          row({ stage: 'build_rounds', round: 1, artifact_type: 'round_summary' }),
          row({
            stage: 'build_rounds',
            round: 2,
            artifact_id: null,
            artifact_type: 'round_summary',
            state: 'waiting',
            since: null,
            due_at: null,
          }),
        ],
        [project({ stage: 'build_rounds' })],
      ),
    );
    expect(q.items.map((i) => [i.round, i.actionable])).toEqual([
      [1, true],
      [2, false],
    ]);
    expect(q.waitingForAgent).toEqual([]);
  });

  it('lists a build-rounds project with nothing in review as waiting for the agent', () => {
    const q = buildQueue(
      input(
        [
          row({
            stage: 'build_rounds',
            round: null,
            artifact_id: null,
            artifact_type: 'round_summary',
            state: 'waiting',
            since: null,
            due_at: null,
          }),
        ],
        [project({ stage: 'build_rounds' })],
      ),
    );
    expect(q.waitingForAgent.map((p) => p.id)).toEqual(['p1']);
  });

  it('puts the longest wait first and takes the deadline from the row', () => {
    const q = buildQueue(
      input(
        [
          row({ since: hoursAgo(2) }),
          row({
            project_id: 'p2',
            since: hoursAgo(30),
            due_at: new Date(Date.parse(hoursAgo(30)) + 48 * 3_600_000).toISOString(),
          }),
        ],
        [project(), project({ id: 'p2', name: 'Law' })],
      ),
    );
    expect(q.items.map((i) => i.projectId)).toEqual(['p2', 'p1']);
    expect(q.items[0]!.escalateAfterHours).toBe(48);
  });

  describe('Feedback and Reject (P2-T19)', () => {
    it('offers Feedback and Reject on a draft at its next gate, with the loops used', () => {
      const q = buildQueue(input([row({ feedback_used: 1 })]));
      expect(q.items[0]).toMatchObject({
        canReject: true,
        canFeedback: true,
        rejected: false,
        feedbackUsed: 1,
        feedbackCap: 3,
      });
    });
    it('hides Feedback once the cap is used, keeping Accept and Reject', () => {
      const q = buildQueue(input([row({ feedback_used: 3, feedback_cap: 3 })]));
      expect(q.items[0]).toMatchObject({ canFeedback: false, canReject: true, actionable: true });
    });
    it('uses the cap from the database (the prototype has 2)', () => {
      const q = buildQueue(
        input(
          [row({ stage: 'prototype', feedback_used: 2, feedback_cap: 2 })],
          [project({ stage: 'prototype' })],
        ),
      );
      expect(q.items[0]!.canFeedback).toBe(false);
    });
    it('shows a rejected version once, with Feedback only, and not as waiting for the agent', () => {
      const rej = {
        state: 'waiting' as const,
        artifact_status: 'rejected' as const,
        since: null,
        due_at: null,
      };
      const q = buildQueue(
        input([
          row({ ...rej, feedback_used: 1 }),
          row({ ...rej, gate_type: 'hard', feedback_used: 1 }),
        ]),
      );
      expect(q.items).toHaveLength(1);
      expect(q.items[0]).toMatchObject({
        rejected: true,
        actionable: false,
        canReject: false,
        canFeedback: true,
        artifactId: 'a1',
      });
      expect(q.waitingForAgent).toEqual([]);
    });
    it('offers nothing on a rejected version whose loops are used up', () => {
      const q = buildQueue(
        input([
          row({
            state: 'waiting',
            artifact_status: 'rejected',
            feedback_used: 3,
            since: null,
            due_at: null,
          }),
        ]),
      );
      expect(q.items[0]).toMatchObject({ canFeedback: false, canReject: false, actionable: false });
    });
    it('still lists a project with no version at all as waiting for the agent', () => {
      const q = buildQueue(
        input([
          row({
            state: 'waiting',
            artifact_id: null,
            artifact_status: null,
            since: null,
            due_at: null,
          }),
        ]),
      );
      expect(q.items).toEqual([]);
      expect(q.waitingForAgent).toHaveLength(1);
    });
    it('offers no Feedback or Reject on a build round yet (phase 4)', () => {
      const q = buildQueue(
        input(
          [row({ stage: 'build_rounds', round: 1, artifact_type: 'round_summary' })],
          [project({ stage: 'build_rounds' })],
        ),
      );
      expect(q.items[0]).toMatchObject({ canFeedback: false, canReject: false });
    });
  });
});
