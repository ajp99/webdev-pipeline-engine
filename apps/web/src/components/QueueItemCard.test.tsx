import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { QueueItem } from '@wpe/shared';

vi.mock('@/app/owner/queue/actions', () => ({ acceptGate: () => {} }));
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
});
