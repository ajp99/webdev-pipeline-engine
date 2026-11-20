// Owner-run (P3-T09): pnpm --filter @wpe/worker provision <project-id> --github-owner <owner> [--dry-run]
//                     pnpm --filter @wpe/worker provision <project-id> --github-owner <owner> --cleanup --confirm "<name>"
// Reads apps/worker/.env for the database only. Until go-live (G33, D-328) there are no GitHub or Vercel
// accounts: --dry-run lists the steps; a real run or cleanup refuses. The tokens for the real run will come from
// the owner's shell at run time and are never written to apps/worker/.env (workers never receive them).
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@wpe/shared';
import {
  cleanup,
  provision,
  type GitHubClient,
  type ProjectStore,
  type VercelClient,
} from './provision';

const args = process.argv.slice(2);
const projectId = args[0];
const flag = (name: string) => args.includes(name);
const value = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const githubOwner = value('--github-owner');
if (!projectId || !githubOwner)
  throw new Error(
    'Usage: provision <project-id> --github-owner <owner> [--dry-run | --cleanup --confirm "<project name>"]',
  );
const dryRun = flag('--dry-run');

const notYet = (what: string) => async (): Promise<never> => {
  throw new Error(`${what} is not available until go-live (G33): run with --dry-run`);
};
// Until go-live nothing exists on GitHub or Vercel, so every check answers "not done" and every change refuses.
const github: GitHubClient = {
  repoExists: async () => false,
  hasStarter: async () => false,
  appInstalled: async () => false,
  createPrivateRepo: notYet('Creating a GitHub repository'),
  pushStarter: notYet('Pushing the starter'),
  installApp: notYet('Installing the GitHub App'),
  deleteRepo: notYet('Deleting a GitHub repository'),
};
const vercel: VercelClient = {
  findProject: async () => null,
  protectionOn: async () => false,
  createProject: notYet('Creating a Vercel project'),
  deleteProject: notYet('Deleting a Vercel project'),
};

const need = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set in apps/worker/.env`);
  return v;
};
const admin = createClient<Database>(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});
// github_repo and vercel_project_id are owner-only fields, kept in project_internal (D-060).
const store: ProjectStore = {
  async get(id) {
    const [p, internal] = await Promise.all([
      admin.from('projects').select('name').eq('id', id).maybeSingle(),
      admin
        .from('project_internal')
        .select('github_repo, vercel_project_id')
        .eq('project_id', id)
        .maybeSingle(),
    ]);
    if (p.error) throw new Error(p.error.message);
    if (internal.error) throw new Error(internal.error.message);
    if (!p.data) return null;
    return {
      name: p.data.name,
      github_repo: internal.data?.github_repo ?? null,
      vercel_project_id: internal.data?.vercel_project_id ?? null,
    };
  },
  async record(id, values) {
    const r = await admin.from('project_internal').update(values).eq('project_id', id);
    if (r.error) throw new Error(r.error.message);
  },
};
const ctx = { github, vercel, store, log: (l: string) => console.log(l) };
if (flag('--cleanup'))
  await cleanup(ctx, projectId, { githubOwner, confirm: value('--confirm') ?? '' });
else await provision(ctx, projectId, { githubOwner, dryRun });
