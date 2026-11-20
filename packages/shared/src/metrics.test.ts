import { describe, expect, it } from 'vitest';
import { feedbackLoops, gateTimings, type MetricArtifact } from './metrics';

// Fixture: project p1 with an intake record, two PRD versions and a prototype with owner then client gates.
const t = (h: number) => new Date(Date.UTC(2026, 0, 1) + h * 3_600_000).toISOString();
const artifacts: MetricArtifact[] = [
  { id: 'i1', project_id: 'p1', type: 'intake_record', version: 1, created_at: t(0) },
  { id: 'd1', project_id: 'p1', type: 'prd', version: 1, created_at: t(10) },
  { id: 'd2', project_id: 'p1', type: 'prd', version: 2, created_at: t(20) },
  { id: 'x1', project_id: 'p1', type: 'prototype', version: 1, created_at: t(100) },
  { id: 'q1', project_id: 'p2', type: 'prd', version: 1, created_at: t(0) },
];

describe('gateTimings', () => {
  const approvals = [
    { artifact_id: 'i1', gate_type: 'soft', role: 'owner', at: t(2) },
    { artifact_id: 'd2', gate_type: 'client', role: 'client', at: t(68) },
    { artifact_id: 'q1', gate_type: 'client', role: 'client', at: t(24) },
    { artifact_id: 'x1', gate_type: 'soft', role: 'owner', at: t(101) },
    // The client's wait starts when the owner approved, not when the prototype was written.
    { artifact_id: 'x1', gate_type: 'client', role: 'client', at: t(105) },
    { artifact_id: 'gone', gate_type: 'soft', role: 'owner', at: t(1) },
  ];
  it('measures each gate from the version or the gate before it, with median and max', () => {
    expect(gateTimings(artifacts, approvals)).toEqual([
      { gate: 'intake_record: owner soft', decisions: 1, medianHours: 2, maxHours: 2 },
      { gate: 'prd: client', decisions: 2, medianHours: 36, maxHours: 48 },
      { gate: 'prototype: client', decisions: 1, medianHours: 4, maxHours: 4 },
      { gate: 'prototype: owner soft', decisions: 1, medianHours: 1, maxHours: 1 },
    ]);
  });
  it('is empty with no approvals, and never negative', () => {
    expect(gateTimings(artifacts, [])).toEqual([]);
    expect(
      gateTimings(artifacts, [
        { artifact_id: 'd1', gate_type: 'client', role: 'client', at: t(5) },
      ])[0]!.maxHours,
    ).toBe(0);
  });
});

describe('feedbackLoops', () => {
  it('counts the owner Feedback and the client requests per project and type', () => {
    expect(
      feedbackLoops(artifacts, [
        { artifact_id: 'd1', source: 'client' },
        { artifact_id: 'd2', source: 'client' },
        { artifact_id: 'x1', source: 'feedback' },
        { artifact_id: 'x1', source: 'feedback' },
        { artifact_id: 'gone', source: 'feedback' },
      ]),
    ).toEqual([
      { project_id: 'p1', type: 'prd', feedback: 0, client: 2 },
      { project_id: 'p1', type: 'prototype', feedback: 2, client: 0 },
    ]);
  });
});
