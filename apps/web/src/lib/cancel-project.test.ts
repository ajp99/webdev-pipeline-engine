import { describe, expect, it } from 'vitest';
import { cancelBlocked, cancelProblem, MAX_CANCEL_REASON_CHARS } from './cancel-project';

describe('cancelBlocked', () => {
  it('allows an active or paused project in any stage before handover', () => {
    for (const status of ['active', 'paused'])
      for (const stage of [
        'intake',
        'requirements',
        'plan',
        'prototype',
        'build_rounds',
        'qc_report',
        'deploy_prep',
      ])
        expect(cancelBlocked(status, stage)).toBeNull();
  });
  it('refuses a closed project and a project at handover', () => {
    expect(cancelBlocked('closed', 'closed')).toMatch(/already closed/);
    expect(cancelBlocked('closed', 'plan')).toMatch(/already closed/);
    expect(cancelBlocked('active', 'handover')).toMatch(/handover/);
  });
});

describe('cancelProblem', () => {
  it('accepts the exact name and a reason', () => {
    expect(cancelProblem('Acme Plumbing', 'Acme Plumbing', 'client left')).toBeNull();
    expect(cancelProblem('Acme Plumbing', '  Acme Plumbing ', 'client left')).toBeNull();
  });
  it('refuses a name that differs in case, spacing or length', () => {
    for (const typed of ['acme plumbing', 'Acme  Plumbing', 'Acme', '', 'Acme Plumbing Ltd'])
      expect(cancelProblem('Acme Plumbing', typed, 'x')).toMatch(/Type the project name exactly/);
  });
  it('refuses an empty or blank reason and one that is too long', () => {
    expect(cancelProblem('A', 'A', '')).toMatch(/reason first/);
    expect(cancelProblem('A', 'A', ' \n\t ')).toMatch(/reason first/);
    expect(cancelProblem('A', 'A', 'x'.repeat(MAX_CANCEL_REASON_CHARS + 1))).toMatch(/at most/);
    expect(cancelProblem('A', 'A', 'x'.repeat(MAX_CANCEL_REASON_CHARS))).toBeNull();
  });
  it('checks the name before the reason', () => {
    expect(cancelProblem('A', 'B', '')).toMatch(/project name/);
  });
});
