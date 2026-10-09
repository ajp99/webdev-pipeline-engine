import { describe, expect, it } from 'vitest';
import { buildQueue, type QueueInput } from './queue';

const NOW = new Date('2026-10-08T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

function input(over: Partial<QueueInput> = {}): QueueInput {
  return {
    now: NOW,
    projects: [{ id: 'p1', name: 'Dental', stage: 'intake', status: 'active' }],
    gateConfig: [
      {
        stage: 'intake',
        project_id: null,
        gate_type: 'soft',
        gatekeeper: 'owner',
        escalate_after_hours: 24,
      },
      {
        stage: 'prototype',
        project_id: null,
        gate_type: 'soft',
        gatekeeper: 'owner',
        escalate_after_hours: 24,
      },
      {
        stage: 'prototype',
        project_id: null,
        gate_type: 'client',
        gatekeeper: 'client',
        escalate_after_hours: 24,
      },
      {
        stage: 'build_rounds',
        project_id: null,
        gate_type: 'soft',
        gatekeeper: 'owner',
        escalate_after_hours: 24,
      },
    ],
    artifacts: [],
    approvals: [],
    rounds: [],
    ...over,
  };
}
const art = (o: Partial<QueueInput['artifacts'][number]> = {}) => ({
  id: 'a1',
  project_id: 'p1',
  type: 'intake_record',
  version: 1,
  status: 'draft' as const,
  created_at: hoursAgo(2),
  ...o,
});

describe('buildQueue', () => {
  it('lists a gate with an artifact and no approval as an actionable item', () => {
    const q = buildQueue(input({ artifacts: [art()] }));
    expect(q.items).toHaveLength(1);
    expect(q.items[0]).toMatchObject({
      projectId: 'p1',
      stage: 'intake',
      gateType: 'soft',
      actionable: true,
      artifactId: 'a1',
      overdue: false,
    });
  });

  it('shows a project with no artifact yet as waiting for the agent, not as an item', () => {
    const q = buildQueue(input());
    expect(q.items).toEqual([]);
    expect(q.waitingForAgent.map((p) => p.id)).toEqual(['p1']);
  });

  it('flags an item overdue once it has waited longer than escalate_after_hours', () => {
    const q = buildQueue(input({ artifacts: [art({ created_at: hoursAgo(25) })] }));
    expect(q.items[0]).toMatchObject({ overdue: true });
    expect(q.items[0]!.hoursWaiting).toBeCloseTo(25, 0);
  });

  it('is not overdue exactly at the limit', () => {
    const q = buildQueue(input({ artifacts: [art({ created_at: hoursAgo(24) })] }));
    expect(q.items[0]!.overdue).toBe(false);
  });

  it('uses the project override for the deadline before the global default', () => {
    const base = input({ artifacts: [art({ created_at: hoursAgo(30) })] });
    base.gateConfig.push({
      stage: 'intake',
      project_id: 'p1',
      gate_type: 'soft',
      gatekeeper: 'owner',
      escalate_after_hours: 48,
    });
    expect(buildQueue(base).items[0]!.overdue).toBe(false);
  });

  it("ignores a different project's override", () => {
    const base = input({ artifacts: [art({ created_at: hoursAgo(30) })] });
    base.gateConfig.push({
      stage: 'intake',
      project_id: 'other',
      gate_type: 'soft',
      gatekeeper: 'owner',
      escalate_after_hours: 48,
    });
    expect(buildQueue(base).items[0]!.overdue).toBe(true);
  });

  it('does not list a gate that already has its approval', () => {
    const q = buildQueue(
      input({
        artifacts: [art()],
        approvals: [{ artifact_id: 'a1', gate_type: 'soft', at: hoursAgo(1) }],
      }),
    );
    expect(q.items).toEqual([]);
  });

  it('works on the newest version and ignores superseded ones', () => {
    const q = buildQueue(
      input({
        artifacts: [
          art({ id: 'old', version: 1, status: 'superseded' }),
          art({ id: 'new', version: 2 }),
        ],
      }),
    );
    expect(q.items.map((i) => i.artifactId)).toEqual(['new']);
  });

  it('puts the client gate behind the owner gate in the prototype stage', () => {
    const proto = input({
      projects: [{ id: 'p1', name: 'Dental', stage: 'prototype', status: 'active' }],
      artifacts: [art({ type: 'prototype' })],
    });
    expect(buildQueue(proto).items.map((i) => [i.gateType, i.actionable])).toEqual([
      ['soft', true],
    ]);
    proto.approvals = [{ artifact_id: 'a1', gate_type: 'soft', at: hoursAgo(1) }];
    const after = buildQueue(proto);
    expect(after.items.map((i) => [i.gateType, i.actionable])).toEqual([['client', false]]);
    expect(after.items[0]!.hoursWaiting).toBeCloseTo(1, 0);
  });

  it('leaves paused and closed projects out of the queue', () => {
    for (const status of ['paused', 'closed'] as const) {
      const q = buildQueue(
        input({ projects: [{ id: 'p1', name: 'D', stage: 'intake', status }], artifacts: [art()] }),
      );
      expect(q.items).toEqual([]);
      expect(q.waitingForAgent).toEqual([]);
    }
  });

  it('lists each round in review at the build_rounds stage', () => {
    const q = buildQueue(
      input({
        projects: [{ id: 'p1', name: 'Dental', stage: 'build_rounds', status: 'active' }],
        rounds: [
          { project_id: 'p1', number: 1, status: 'approved' },
          { project_id: 'p1', number: 2, status: 'in_review' },
        ],
        artifacts: [
          art({ id: 'rs2', type: 'round_summary', version: 3, round: 2, created_at: hoursAgo(5) }),
        ],
      }),
    );
    expect(q.items).toHaveLength(1);
    expect(q.items[0]).toMatchObject({
      round: 2,
      gateType: 'soft',
      artifactId: 'rs2',
      actionable: true,
    });
  });

  it("finds a round's summary by its round number, using the newest version after Feedback", () => {
    const q = buildQueue(
      input({
        projects: [{ id: 'p1', name: 'Dental', stage: 'build_rounds', status: 'active' }],
        rounds: [{ project_id: 'p1', number: 1, status: 'in_review' }],
        artifacts: [
          art({ id: 'rs1', type: 'round_summary', version: 1, round: 1, status: 'superseded' }),
          art({ id: 'rs2', type: 'round_summary', version: 2, round: 1 }),
          art({ id: 'other', type: 'round_summary', version: 3, round: 2 }),
        ],
      }),
    );
    expect(q.items.map((i) => i.artifactId)).toEqual(['rs2']);
  });

  it('lists a project whose gates are all approved as ready to advance, with the next stage', () => {
    const q = buildQueue(
      input({
        artifacts: [art()],
        approvals: [{ artifact_id: 'a1', gate_type: 'soft', at: hoursAgo(1) }],
      }),
    );
    expect(q.items).toEqual([]);
    expect(q.ready.map((r) => [r.project.id, r.nextStage])).toEqual([['p1', 'requirements']]);
  });

  it('does not call a project ready while a gate is open or the agent has not produced the artifact', () => {
    expect(buildQueue(input({ artifacts: [art()] })).ready).toEqual([]);
    expect(buildQueue(input()).ready).toEqual([]);
  });

  it('sorts the longest wait first', () => {
    const q = buildQueue(
      input({
        projects: [
          { id: 'p1', name: 'A', stage: 'intake', status: 'active' },
          { id: 'p2', name: 'B', stage: 'intake', status: 'active' },
        ],
        artifacts: [
          art({ id: 'a1', created_at: hoursAgo(3) }),
          art({ id: 'a2', project_id: 'p2', created_at: hoursAgo(9) }),
        ],
      }),
    );
    expect(q.items.map((i) => i.projectId)).toEqual(['p2', 'p1']);
  });
});

describe('remainingOwnerGates', () => {
  it('is empty once every owner gate of the stage is approved', async () => {
    const { remainingGates } = await import('./queue');
    const proto = input({
      projects: [{ id: 'p1', name: 'D', stage: 'prototype', status: 'active' }],
      artifacts: [art({ type: 'prototype' })],
    });
    expect(remainingGates(proto, 'p1').map((g) => g.gateType)).toEqual(['soft', 'client']);
    proto.approvals = [{ artifact_id: 'a1', gate_type: 'soft', at: hoursAgo(1) }];
    expect(remainingGates(proto, 'p1').map((g) => g.gateType)).toEqual(['client']);
    proto.approvals.push({ artifact_id: 'a1', gate_type: 'client', at: hoursAgo(0) });
    expect(remainingGates(proto, 'p1')).toEqual([]);
  });
});
