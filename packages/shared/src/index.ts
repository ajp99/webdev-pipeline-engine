// Stage and gate types derived from docs/spec arrive in P1-T03/P1-T04.
export const STAGES = [
  'intake',
  'requirements',
  'plan',
  'prototype',
  'build_rounds',
  'qc_report',
  'deploy_prep',
  'handover',
  'closed',
] as const;

export type Stage = (typeof STAGES)[number];
