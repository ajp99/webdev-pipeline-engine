import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { QueueItem } from '@wpe/shared';

vi.mock('@/app/owner/queue/actions', () => ({
  acceptGate: () => {},
  rejectGate: () => {},
  sendFeedback: () => {},
}));
import { QueueItemCard, waitedLabel } from './QueueItemCard';

const base: QueueItem = {
  key: 'k',
  projectId: 'p1',
  projectName: 'Dental',
  stage: 'prototype',
  gateType: 'soft',
  gatekeeper: 'owner',
  actionable: true,
  artifactId: 'a1',
  artifactType: 'prototype',
  round: null,
  since: '2026-10-07T00:00:00Z',
  hoursWaiting: 30,
  escalateAfterHours: 24,
  overdue: true,
  canReject: true,
  canFeedback: true,
  feedbackUsed: 1,
  feedbackCap: 3,
};
const html = (over: Partial<QueueItem> = {}) =>
  renderToStaticMarkup(<QueueItemCard item={{ ...base, ...over }} />);

describe('QueueItemCard', () => {
  it('shows the gate type, the three actions and an overdue badge with its limit', () => {
    const h = html();
    expect(h).toContain('soft gate');
    expect(h).toContain('Accept');
    expect(h).toContain('Feedback');
    expect(h).toContain('Reject');
    expect(h).toContain('Overdue (limit 24 h)');
  });
  it('shows no overdue badge when the gate is within its limit', () => {
    expect(html({ overdue: false, hoursWaiting: 3 })).not.toContain('Overdue');
  });
  it('disables Accept on a client gate and says who is being waited for', () => {
    const h = html({ gateType: 'client', gatekeeper: 'client', actionable: false });
    expect(h).toContain('client gate');
    expect(h).toContain('Waiting for the client');
    expect(h).toMatch(/<button[^>]*disabled[^>]*>Accept/);
  });
  it('waitedLabel', () => {
    expect(waitedLabel(0.2)).toBe('under an hour');
    expect(waitedLabel(30)).toBe('30 h');
    expect(waitedLabel(72)).toBe('3 days');
  });
  it('offers Reject and a Feedback form with the loops used', () => {
    const h = html();
    expect(h).not.toMatch(/<button[^>]* disabled=""[^>]*>Reject/);
    expect(h).toContain('Feedback (1 of 3 used)');
    expect(h).toContain('name="body"');
    expect(h).toContain('maxLength="10000"');
  });
  it('after the cap shows no Feedback form, only Accept or Reject', () => {
    const h = html({ canFeedback: false, feedbackUsed: 3 });
    expect(h).not.toContain('name="body"');
    expect(h).toContain('Feedback used up (3 of 3): accept or reject this version.');
    expect(h).not.toMatch(/<button[^>]* disabled=""[^>]*>Accept/);
  });
  it('a build round shows no Feedback form yet', () => {
    const h = html({ round: 1, canFeedback: false, canReject: false });
    expect(h).not.toContain('name="body"');
    expect(h).not.toContain('Feedback used up');
  });
});
