// The project provisioning script (P3-T09, D-328): the owner runs it once per project to create the client's
// GitHub repository from the master starter, install the GitHub App on it, create and link the Vercel project
// (production from main, previews from staging, Vercel's login protection left on) and record github_repo and
// vercel_project_id. Every step checks first whether it is already done, so a rerun resumes. --dry-run shows the
// steps without changing anything; cleanup removes a half-created project after the owner types its name.
// Until go-live it runs only against fake clients (G33). Workers never receive these credentials.

export type RepoRef = { owner: string; name: string };

export interface GitHubClient {
  repoExists(r: RepoRef): Promise<boolean>;
  createPrivateRepo(r: RepoRef): Promise<void>;
  /** True when the repository has a main branch with at least one commit. */
  hasStarter(r: RepoRef): Promise<boolean>;
  /** Pushes the master starter as the first commit on main, and creates staging from it. */
  pushStarter(r: RepoRef): Promise<void>;
  appInstalled(r: RepoRef): Promise<boolean>;
  installApp(r: RepoRef): Promise<void>;
  deleteRepo(r: RepoRef): Promise<void>;
}

export interface VercelClient {
  /** The project's id, or null when there is no project with this name. */
  findProject(name: string): Promise<string | null>;
  /** Creates the project linked to the repository: production from main, previews from other branches. */
  createProject(name: string, repo: RepoRef): Promise<string>;
  /** True when deployment protection (Vercel login) is on for previews and production. */
  protectionOn(id: string): Promise<boolean>;
  deleteProject(id: string): Promise<void>;
}

export interface ProjectStore {
  get(
    projectId: string,
  ): Promise<{ name: string; github_repo: string | null; vercel_project_id: string | null } | null>;
  record(
    projectId: string,
    values: { github_repo?: string | null; vercel_project_id?: string | null },
  ): Promise<void>;
}

export type Step = { id: string; label: string; done: boolean };
type Ctx = {
  github: GitHubClient;
  vercel: VercelClient;
  store: ProjectStore;
  log: (line: string) => void;
};

/** The client's repository and Vercel project are named from the project: lower case, hyphens, at most 60. */
export function slugFor(projectName: string): string {
  const s = projectName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  if (!s) throw new Error('the project name gives no usable repository name');
  return `site-${s}`;
}

async function steps(
  c: Ctx,
  repo: RepoRef,
  project: { github_repo: string | null; vercel_project_id: string | null },
): Promise<Step[]> {
  const exists = await c.github.repoExists(repo);
  const vercelId = await c.vercel.findProject(repo.name);
  return [
    { id: 'repo', label: `create the private repository ${repo.owner}/${repo.name}`, done: exists },
    {
      id: 'starter',
      label: 'push the master starter to main and create staging',
      done: exists && (await c.github.hasStarter(repo)),
    },
    {
      id: 'app',
      label: 'install the GitHub App on the repository only',
      done: exists && (await c.github.appInstalled(repo)),
    },
    {
      id: 'vercel',
      label: `create the Vercel project ${repo.name} linked to the repository (production: main; previews: staging)`,
      done: vercelId !== null,
    },
    {
      id: 'protection',
      label: "check Vercel's login protection is on",
      done: vercelId !== null && (await c.vercel.protectionOn(vercelId)),
    },
    {
      id: 'record',
      label: 'record github_repo and vercel_project_id on the project',
      done:
        project.github_repo === `${repo.owner}/${repo.name}` &&
        vercelId !== null &&
        project.vercel_project_id === vercelId,
    },
  ];
}

export async function provision(
  c: Ctx,
  projectId: string,
  opts: { githubOwner: string; dryRun: boolean },
): Promise<Step[]> {
  const project = await c.store.get(projectId);
  if (!project) throw new Error('project not found');
  const repo = { owner: opts.githubOwner, name: slugFor(project.name) };
  const plan = await steps(c, repo, project);
  for (const s of plan)
    c.log(`${s.done ? 'done   ' : opts.dryRun ? 'planned' : 'doing  '} ${s.label}`);
  if (opts.dryRun) return plan;
  for (const s of plan) {
    if (s.done) continue;
    if (s.id === 'repo') await c.github.createPrivateRepo(repo);
    if (s.id === 'starter') await c.github.pushStarter(repo);
    if (s.id === 'app') await c.github.installApp(repo);
    if (s.id === 'vercel') await c.vercel.createProject(repo.name, repo);
    if (s.id === 'protection') {
      const id = await c.vercel.findProject(repo.name);
      if (!id || !(await c.vercel.protectionOn(id)))
        throw new Error(
          "Vercel's login protection is off: turn it on in the project's settings, then run again",
        );
    }
    if (s.id === 'record') {
      const id = await c.vercel.findProject(repo.name);
      await c.store.record(projectId, {
        github_repo: `${repo.owner}/${repo.name}`,
        vercel_project_id: id,
      });
    }
    c.log(`done    ${s.label}`);
  }
  return steps(c, repo, await c.store.get(projectId).then((p) => p!));
}

/** Removes a half-created project after the owner types the project's name exactly. */
export async function cleanup(
  c: Ctx,
  projectId: string,
  opts: { githubOwner: string; confirm: string },
): Promise<void> {
  const project = await c.store.get(projectId);
  if (!project) throw new Error('project not found');
  if (opts.confirm !== project.name)
    throw new Error(
      `cleanup removes the repository and the Vercel project: type the project name "${project.name}" to confirm`,
    );
  const repo = { owner: opts.githubOwner, name: slugFor(project.name) };
  const id = await c.vercel.findProject(repo.name);
  if (id) {
    await c.vercel.deleteProject(id);
    c.log(`removed the Vercel project ${repo.name}`);
  }
  if (await c.github.repoExists(repo)) {
    await c.github.deleteRepo(repo);
    c.log(`removed the repository ${repo.owner}/${repo.name}`);
  }
  await c.store.record(projectId, { github_repo: null, vercel_project_id: null });
  c.log('cleared github_repo and vercel_project_id');
}
