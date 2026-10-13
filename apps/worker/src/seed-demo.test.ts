import { describe, expect, it } from 'vitest';
import { seedDemo, type SeedDeps } from './seed-demo';

describe('seedDemo', () => {
  it('creates one project and one intake record for it', async () => {
    const calls: string[] = [];
    const deps: SeedDeps = {
      createProject: async (name) => (calls.push(`project ${name}`), 'p1'),
      createArtifact: async (pid, type, content) => (
        calls.push(`artifact ${pid} ${type} ${JSON.stringify(content.dummy)}`),
        'a1'
      ),
    };
    const r = await seedDemo(deps, '2026-10-08');
    expect(r).toEqual({ projectId: 'p1', artifactId: 'a1' });
    expect(calls).toEqual(['project Gate demo 2026-10-08', 'artifact p1 intake_record true']);
  });
});
