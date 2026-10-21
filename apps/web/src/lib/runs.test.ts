import { describe, expect, it } from 'vitest';
import { canCancel, durationLabel, isActive, statusLabel } from './runs';

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
