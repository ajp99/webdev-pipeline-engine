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

/**
 * The client's repository and Vercel project are named from the project plus the first 8 characters of its id,
 * so two projects with the same name never share them: lower case, hyphens.
 */
export function slugFor(projectName: string, projectId: string): string {
  const s = projectName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
  const id = projectId
    .toLowerCase()
    .replace(/[^0-9a-f]/g, '')
    .slice(0, 8);
  if (!s || id.length < 8)
    throw new Error('the project name or id gives no usable repository name');
  return `site-${s}-${id}`;
}

type Project = { name: string; github_repo: string | null; vercel_project_id: string | null };

/**
 * What is done. A repository or Vercel project counts as this project's only when its id is recorded on the
 * project (each is recorded right after it is created); one with the same name that is not recorded stops the
 * script instead of being taken over (gate review).
 */
async function steps(c: Ctx, repo: RepoRef, project: Project): Promise<Step[]> {
  const full = `${repo.owner}/${repo.name}`;
  const exists = await c.github.repoExists(repo);
  if (exists && project.github_repo !== full)
    throw new Error(
      `a repository ${full} exists but is not recorded for this project: check it by hand`,
    );
  const vercelId = await c.vercel.findProject(repo.name);
  if (vercelId && project.vercel_project_id !== vercelId)
    throw new Error(
      `a Vercel project ${repo.name} exists but is not recorded for this project: check it by hand`,
    );
  const mine = exists && project.github_repo === full;
  return [
    { id: 'repo', label: `create the private repository ${full} and record it`, done: mine },
    {
      id: 'starter',
      label: 'push the master starter to main and create staging',
      done: mine && (await c.github.hasStarter(repo)),
    },
    {
      id: 'app',
      label: 'install the GitHub App on the repository only',
      done: mine && (await c.github.appInstalled(repo)),
    },
    {
      id: 'vercel',
      label: `create the Vercel project ${repo.name} linked to the repository (production: main; previews: staging) and record it`,
      done: vercelId !== null,
    },
    {
      id: 'protection',
      label: "check Vercel's login protection is on",
      done: vercelId !== null && (await c.vercel.protectionOn(vercelId)),
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
  const repo = { owner: opts.githubOwner, name: slugFor(project.name, projectId) };
  const plan = await steps(c, repo, project);
  for (const s of plan)
    c.log(`${s.done ? 'done   ' : opts.dryRun ? 'planned' : 'doing  '} ${s.label}`);
  if (opts.dryRun) return plan;
  for (const s of plan) {
    if (s.done) continue;
    if (s.id === 'repo') {
      await c.github.createPrivateRepo(repo);
      await c.store.record(projectId, { github_repo: `${repo.owner}/${repo.name}` });
    }
    if (s.id === 'starter') await c.github.pushStarter(repo);
    if (s.id === 'app') await c.github.installApp(repo);
    if (s.id === 'vercel') {
      const id = await c.vercel.createProject(repo.name, repo);
      await c.store.record(projectId, { vercel_project_id: id });
    }
    if (s.id === 'protection') {
      const id = (await c.store.get(projectId))?.vercel_project_id;
      if (!id || !(await c.vercel.protectionOn(id)))
        throw new Error(
          "Vercel's login protection is off: turn it on in the project's settings, then run again",
        );
    }
    c.log(`done    ${s.label}`);
  }
  return steps(c, repo, (await c.store.get(projectId))!);
}

/** Removes what this project recorded (a half-created project too), after the owner types its name exactly. */
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
  if (project.vercel_project_id) {
    await c.vercel.deleteProject(project.vercel_project_id);
    c.log(`removed the Vercel project ${project.vercel_project_id}`);
  }
  if (project.github_repo) {
    const [owner, name] = project.github_repo.split('/') as [string, string];
    if (await c.github.repoExists({ owner, name })) {
      await c.github.deleteRepo({ owner, name });
      c.log(`removed the repository ${project.github_repo}`);
    }
  }
  await c.store.record(projectId, { github_repo: null, vercel_project_id: null });
  c.log('cleared github_repo and vercel_project_id');
}
