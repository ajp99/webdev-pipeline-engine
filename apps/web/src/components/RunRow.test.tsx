import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { RunRowData } from '../lib/runs';

vi.mock('@/app/owner/runs/actions', () => ({ cancelRun: () => {} }));
import { RunRow } from './RunRow';

const base: RunRowData = {
  id: 'r1',
  projectName: 'Acme',
  stage: 'build_rounds',
  status: 'running',
  attempts: 1,
  queuedAt: '2026-10-21T12:00:00Z',
  startedAt: '2026-10-21T12:00:10Z',
  finishedAt: null,
  tokensUsed: 120,
  model: null,
};
const now = new Date('2026-10-21T12:01:10Z');
const html = (over: Partial<RunRowData> = {}) =>
  renderToStaticMarkup(
    <table>
      <tbody>
        <RunRow run={{ ...base, ...over }} now={now} />
      </tbody>
    </table>,
  );

describe('RunRow', () => {
  it('shows the project, stage, status, attempts, time and tokens', () => {
    const h = html();
    expect(h).toContain('Acme');
    expect(h).toContain('build rounds');
    expect(h).toContain('Running');
    expect(h).toContain('1 min 0 s');
    expect(h).toContain('120');
  });
  it('offers Cancel on a running or queued run, with the run id', () => {
    expect(html()).toContain('Cancel');
    expect(html()).toContain('value="r1"');
    expect(html({ status: 'queued', startedAt: null })).toContain('Cancel');
  });
  it('offers no Cancel once the run is stopping or finished', () => {
    for (const status of ['cancel_requested', 'succeeded', 'failed', 'cancelled', 'stopped'])
      expect(html({ status })).not.toContain('>Cancel<');
  });
  it('marks a stub run', () => {
    expect(html({ model: 'stub' })).toContain('(stub)');
  });
});
