import { describe, expect, it } from 'vitest';
import {
  cleanup,
  provision,
  slugFor,
  type GitHubClient,
  type ProjectStore,
  type RepoRef,
  type VercelClient,
} from './provision';

/** In-memory GitHub, Vercel and project row; `failAt` makes one step fail once. */
function world(failAt?: string) {
  const repos = new Map<string, { starter: boolean; app: boolean }>();
  const projects = new Map<string, { id: string; protection: boolean }>();
  const row = {
    name: 'Brightside Family Dental',
    github_repo: null as string | null,
    vercel_project_id: null as string | null,
  };
  const calls: string[] = [];
  let failed = false;
  const step = (name: string) => {
    calls.push(name);
    if (failAt === name && !failed) {
      failed = true;
      throw new Error(`${name} failed`);
    }
  };
  const key = (r: RepoRef) => `${r.owner}/${r.name}`;
  const github: GitHubClient = {
    repoExists: async (r) => repos.has(key(r)),
    createPrivateRepo: async (r) => (
      step('createRepo'),
      void repos.set(key(r), { starter: false, app: false })
    ),
    hasStarter: async (r) => repos.get(key(r))?.starter ?? false,
    pushStarter: async (r) => (step('pushStarter'), void (repos.get(key(r))!.starter = true)),
    appInstalled: async (r) => repos.get(key(r))?.app ?? false,
    installApp: async (r) => (step('installApp'), void (repos.get(key(r))!.app = true)),
    deleteRepo: async (r) => (step('deleteRepo'), void repos.delete(key(r))),
  };
  const vercel: VercelClient = {
    findProject: async (n) => projects.get(n)?.id ?? null,
    createProject: async (n) => (
      step('createProject'),
      projects.set(n, { id: `prj_${n}`, protection: true }),
      `prj_${n}`
    ),
    protectionOn: async (id) => [...projects.values()].some((p) => p.id === id && p.protection),
    deleteProject: async (id) => {
      step('deleteProject');
      for (const [n, p] of projects) if (p.id === id) projects.delete(n);
    },
  };
  const store: ProjectStore = {
    get: async () => ({ ...row }),
    record: async (_id, v) => void Object.assign(row, v),
  };
  const log: string[] = [];
  return {
    ctx: { github, vercel, store, log: (l: string) => void log.push(l) },
    repos,
    projects,
    row,
    calls,
    log,
  };
}

describe('slugFor', () => {
  it('names the repository and the Vercel project from the project', () => {
    expect(slugFor('Brightside Family Dental')).toBe('site-brightside-family-dental');
    expect(slugFor('Café & Co!')).toBe('site-cafe-co');
    expect(() => slugFor('!!!')).toThrow('no usable');
  });
});

describe('provision', () => {
  it('a dry run lists every step as planned and changes nothing', async () => {
    const w = world();
    const steps = await provision(w.ctx, 'p1', { githubOwner: 'agency', dryRun: true });
    expect(steps.every((s) => !s.done)).toBe(true);
    expect(w.calls).toEqual([]);
    expect(w.log[0]).toBe(
      'planned create the private repository agency/site-brightside-family-dental',
    );
  });
  it('runs every step once and records the repository and the Vercel project', async () => {
    const w = world();
    const steps = await provision(w.ctx, 'p1', { githubOwner: 'agency', dryRun: false });
    expect(w.calls).toEqual(['createRepo', 'pushStarter', 'installApp', 'createProject']);
    expect(w.row).toMatchObject({
      github_repo: 'agency/site-brightside-family-dental',
      vercel_project_id: 'prj_site-brightside-family-dental',
    });
    expect(steps.every((s) => s.done)).toBe(true);
  });
  it('a rerun after a failure resumes where it stopped and does nothing twice', async () => {
    const w = world('installApp');
    await expect(provision(w.ctx, 'p1', { githubOwner: 'agency', dryRun: false })).rejects.toThrow(
      'installApp failed',
    );
    await provision(w.ctx, 'p1', { githubOwner: 'agency', dryRun: false });
    expect(w.calls).toEqual([
      'createRepo',
      'pushStarter',
      'installApp',
      'installApp',
      'createProject',
    ]);
    await provision(w.ctx, 'p1', { githubOwner: 'agency', dryRun: false });
    expect(w.calls).toHaveLength(5);
  });
  it("stops when Vercel's login protection is off", async () => {
    const w = world();
    const create = w.ctx.vercel.createProject;
    w.ctx.vercel.createProject = async (n, r) => {
      const id = await create(n, r);
      w.projects.get(n)!.protection = false;
      return id;
    };
    await expect(provision(w.ctx, 'p1', { githubOwner: 'agency', dryRun: false })).rejects.toThrow(
      'login protection is off',
    );
    expect(w.row.vercel_project_id).toBeNull();
  });
});

describe('cleanup', () => {
  it('needs the project name typed exactly, then removes both and clears the columns', async () => {
    const w = world();
    await provision(w.ctx, 'p1', { githubOwner: 'agency', dryRun: false });
    await expect(
      cleanup(w.ctx, 'p1', { githubOwner: 'agency', confirm: 'brightside' }),
    ).rejects.toThrow('type the project name');
    expect(w.repos.size).toBe(1);
    await cleanup(w.ctx, 'p1', { githubOwner: 'agency', confirm: 'Brightside Family Dental' });
    expect(w.repos.size).toBe(0);
    expect(w.projects.size).toBe(0);
    expect(w.row).toMatchObject({ github_repo: null, vercel_project_id: null });
  });
  it('cleans a half-created project (repository only)', async () => {
    const w = world('createProject');
    await expect(
      provision(w.ctx, 'p1', { githubOwner: 'agency', dryRun: false }),
    ).rejects.toThrow();
    await cleanup(w.ctx, 'p1', { githubOwner: 'agency', confirm: 'Brightside Family Dental' });
    expect(w.calls.slice(-1)).toEqual(['deleteRepo']);
  });
});
