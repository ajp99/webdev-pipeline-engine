// The Prototype agent's working directory (P3-T04, D-328): a local git repository per project, made from the
// master starter, where the agent's work is committed to `staging`. Before every run every starter file the
// agent may not write is put back, and anything else is removed, because this worker builds and serves the site
// as the owner (D-310, G19). No GitHub or Vercel token is used until go-live (G33).
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type { RunIo } from './builder';
import { PROTOTYPE_WRITES } from './builder-guard';
import { run, STARTER, workDirFor, workRoot } from './builder-host';

/** Build output and local records that may stay between runs. */
const KEEP = new Set([
  'node_modules',
  '.next',
  'next-env.d.ts',
  'tsconfig.tsbuildinfo',
  '.git',
  '.wpe-preview.json',
  '.wpe-preview.log',
]);

async function exists(p: string) {
  return stat(p).then(
    () => true,
    () => false,
  );
}

async function files(root: string, dir = root): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    const rel = relative(root, p);
    if (KEEP.has(rel.split(sep)[0]!)) continue;
    if (e.isDirectory()) out.push(...(await files(root, p)));
    else out.push(rel);
  }
  return out;
}

/**
 * Restores every starter file the agent may not write, and removes every file that is neither a starter file
 * nor writable by the agent. Files the agent may write stay as the last run left them (they are its work).
 */
export async function resetForPrototype(dir: string, starter = STARTER): Promise<void> {
  const starterFiles = new Set(
    (await files(starter)).filter((f) => !f.startsWith(`node_modules${sep}`)),
  );
  for (const f of await files(dir)) {
    if (!starterFiles.has(f) && !PROTOTYPE_WRITES.canWrite(f))
      await rm(join(dir, f), { force: true });
  }
  for (const f of starterFiles) {
    if (PROTOTYPE_WRITES.canWrite(f) && (await exists(join(dir, f)))) continue;
    await mkdir(join(dir, f, '..'), { recursive: true });
    await cp(join(starter, f), join(dir, f));
  }
}

const git = (dir: string, io: RunIo, ...args: string[]) =>
  run(
    'git',
    ['-c', 'user.name=CreatePipeline Prototype', '-c', 'user.email=prototype@localhost', ...args],
    {
      cwd: dir,
      io,
      label: `git ${args[0]}`,
    },
  );

/** The project's repository on `staging`, starter files restored, dependencies installed. */
export async function prepareRepo(
  projectId: string,
  io: RunIo,
  root = workRoot(),
  starter = STARTER,
): Promise<string> {
  const dir = join(workDirFor(projectId, root), 'site');
  await mkdir(dir, { recursive: true });
  if (!(await exists(join(dir, '.git')))) {
    io.log('info', `creating the site repository in ${dir}`);
    await cp(starter, dir, {
      recursive: true,
      filter: (src) => !/[\\/](node_modules|\.next)([\\/]|$)/.test(src),
    });
    await git(dir, io, 'init', '-q', '-b', 'main');
    await git(dir, io, 'add', '-A');
    await git(dir, io, 'commit', '-q', '-m', 'Start from the master starter');
    await git(dir, io, 'checkout', '-q', '-B', 'staging');
  } else {
    await git(dir, io, 'checkout', '-q', 'staging');
    await resetForPrototype(dir, starter);
  }
  if (!(await exists(join(dir, 'node_modules')))) {
    io.log('info', 'installing dependencies (frozen lockfile, no install scripts)');
    await run('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts', '--ignore-workspace'], {
      cwd: dir,
      io,
      label: 'pnpm install',
    });
  }
  return dir;
}

/** Commits everything on `staging` and returns the commit id. */
export async function commitStaging(dir: string, io: RunIo, message: string): Promise<string> {
  await git(dir, io, 'add', '-A');
  await git(dir, io, 'commit', '-q', '--allow-empty', '-m', message);
  const { execFile } = await import('node:child_process');
  return new Promise((ok, fail) =>
    execFile('git', ['rev-parse', 'HEAD'], { cwd: dir }, (e, out) =>
      e ? fail(e) : ok(out.trim()),
    ),
  );
}
