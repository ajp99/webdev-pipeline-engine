import { describe, expect, it } from 'vitest';
import {
  canCancel,
  canRetry,
  durationLabel,
  isActive,
  logWindow,
  statusLabel,
  timeline,
} from './runs';

describe('canCancel', () => {
  it('allows queued, running and waiting runs', () => {
    for (const s of ['queued', 'running', 'waiting']) expect(canCancel(s)).toBe(true);
  });
  it('does not allow a run that is stopping or finished', () => {
    for (const s of ['cancel_requested', 'succeeded', 'failed', 'cancelled', 'stopped'])
      expect(canCancel(s)).toBe(false);
  });
});

describe('isActive', () => {
  it('is true until the run has finished', () => {
    for (const s of ['queued', 'running', 'waiting', 'cancel_requested'])
      expect(isActive(s)).toBe(true);
    for (const s of ['succeeded', 'failed', 'cancelled', 'stopped'])
      expect(isActive(s)).toBe(false);
  });
});

describe('labels', () => {
  it('uses plain words', () => {
    expect(statusLabel('cancel_requested')).toBe('Stopping');
    expect(statusLabel('stopped')).toBe('Stopped (no activity)');
    expect(statusLabel('whatever')).toBe('whatever');
  });
  it('shows how long a run took, or has been running', () => {
    const now = new Date('2026-10-21T12:10:00Z');
    expect(durationLabel(null, null, now)).toBe('');
    expect(durationLabel('2026-10-21T12:09:30Z', '2026-10-21T12:09:45Z', now)).toBe('15 s');
    expect(durationLabel('2026-10-21T12:07:00Z', null, now)).toBe('3 min 0 s');
    expect(durationLabel('2026-10-21T09:00:00Z', '2026-10-21T10:30:00Z', now)).toBe('1 h 30 min');
  });
});

describe('canRetry', () => {
  it('allows a run that failed, was stopped or was cancelled', () => {
    for (const s of ['failed', 'stopped', 'cancelled']) expect(canRetry(s)).toBe(true);
  });
  it('does not allow a run that is still going or that succeeded', () => {
    for (const s of ['queued', 'running', 'waiting', 'cancel_requested', 'succeeded'])
      expect(canRetry(s)).toBe(false);
  });
});

describe('logWindow', () => {
  it('shows the last page by default, where the newest lines are', () => {
    expect(logWindow(250, null)).toEqual({ page: 3, pages: 3, from: 200, to: 299 });
  });
  it('shows the page asked for and clamps one that does not exist', () => {
    expect(logWindow(250, 2)).toEqual({ page: 2, pages: 3, from: 100, to: 199 });
    expect(logWindow(250, 9).page).toBe(3);
    expect(logWindow(250, 0).page).toBe(1);
    expect(logWindow(250, Number.NaN).page).toBe(3);
  });
  it('has one empty page for a run with no lines, and a full last page at the boundary', () => {
    expect(logWindow(0, null)).toEqual({ page: 1, pages: 1, from: 0, to: 99 });
    expect(logWindow(100, null).pages).toBe(1);
    expect(logWindow(101, null).pages).toBe(2);
  });
});

describe('timeline', () => {
  it('lists queued, started and the end in order, only what happened', () => {
    expect(
      timeline({ queuedAt: 'a', startedAt: null, finishedAt: null, status: 'queued' }),
    ).toEqual([{ label: 'Queued', at: 'a' }]);
    expect(timeline({ queuedAt: 'a', startedAt: 'b', finishedAt: 'c', status: 'failed' })).toEqual([
      { label: 'Queued', at: 'a' },
      { label: 'Started', at: 'b' },
      { label: 'Failed', at: 'c' },
    ]);
  });
});
