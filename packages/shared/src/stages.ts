// Stage list, kept in its own module so index.ts and queue.ts do not import each other.
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
