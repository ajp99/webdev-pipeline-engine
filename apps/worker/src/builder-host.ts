// The parts of the Builder that touch the host: the working directory, pnpm, the preview server (D-310).
// Child processes get a short list of environment variables, never the worker's keys (D-264, D-295).
import { spawn } from 'node:child_process';
import { cp, mkdir, open, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RunIo } from './builder';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// CLAUDE_CONFIG_DIR is a folder path (where the Claude Code login is kept), not a secret.
const SAFE_ENV = [
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'LANG',
  'LC_ALL',
  'TERM',
  'TMPDIR',
  'SHELL',
  'CLAUDE_CONFIG_DIR',
];
export const STARTER = join(fileURLToPath(import.meta.url), '../../../../templates/master-starter');

/** Where per-project working directories live: WPE_WORK_DIR, else ~/.wpe/work. */
export function workRoot(env: NodeJS.ProcessEnv = process.env): string {
  return env.WPE_WORK_DIR && env.WPE_WORK_DIR.trim() !== ''
    ? env.WPE_WORK_DIR
    : join(homedir(), '.wpe', 'work');
}

/** The project's directory. The id must be a UUID, so it can never point outside the work root. */
export function workDirFor(projectId: string, root = workRoot()): string {
  if (!UUID.test(projectId)) throw new Error('the project id is not a UUID');
  return join(root, projectId.toLowerCase());
}

/** Only the variables a build needs; HOME is kept so the Claude Code login is found. */
export function childEnv(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const out: Record<string, string> = { CI: '1', NEXT_TELEMETRY_DISABLED: '1' };
  for (const k of SAFE_ENV) if (env[k] !== undefined) out[k] = env[k]!;
  return out;
}

function killGroup(pid: number | undefined) {
  if (!pid || !Number.isInteger(pid) || pid <= 1) return;
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    // Already gone.
  }
}

/**
 * Runs a command in its own process group (a cancel stops the build's grandchildren too), feeding every
 * output line to progress; the last lines are kept for an error message.
 */
export function run(
  cmd: string,
  args: string[],
  opts: { cwd: string; io: RunIo; label: string },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: childEnv(),
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stop = () => killGroup(child.pid);
    if (opts.io.signal.aborted) stop();
    else opts.io.signal.addEventListener('abort', stop, { once: true });
    const tail: string[] = [];
    const take = (b: Buffer) => {
      opts.io.progress();
      for (const line of b.toString().split('\n')) {
        if (line.trim() === '') continue;
        tail.push(line);
        if (tail.length > 15) tail.shift();
      }
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', (e) => reject(new Error(`${opts.label}: ${e.message}`)));
    child.on('close', (code) => {
      opts.io.signal.removeEventListener('abort', stop);
      if (opts.io.signal.aborted) return reject(new Error('stopped'));
      return code === 0
        ? resolve()
        : reject(new Error(`${opts.label} failed (exit ${code}):\n${tail.join('\n')}`));
    });
  });
}

// What may sit in a working directory besides the starter's own files: install and build output.
const KEEP = new Set([
  'app',
  'node_modules',
  '.next',
  'next-env.d.ts',
  'tsconfig.tsbuildinfo',
  '.wpe-preview.json',
  '.wpe-preview.log',
]);

/**
 * Puts every starter file outside app/ back as it was, and removes anything else at the top level. The
 * Builder may write only under app/, but a directory is reused from run to run and this worker runs its
 * build and dev server as the owner, so the files that decide what runs are never trusted from an earlier run.
 */
export async function resetNonApp(dir: string, starter = STARTER): Promise<void> {
  const wanted = (await readdir(starter)).filter((n) => n !== 'node_modules' && n !== '.next');
  for (const name of wanted) {
    if (name === 'app') continue;
    await rm(join(dir, name), { recursive: true, force: true });
    await cp(join(starter, name), join(dir, name), { recursive: true });
  }
  for (const name of await readdir(dir)) {
    if (!KEEP.has(name) && !wanted.includes(name))
      await rm(join(dir, name), { recursive: true, force: true });
  }
}

export async function prepareWorkdir(
  projectId: string,
  io: RunIo,
  root = workRoot(),
  starter = STARTER,
): Promise<string> {
  const dir = workDirFor(projectId, root);
  await mkdir(dir, { recursive: true });
  const has = async (p: string) =>
    stat(join(dir, p)).then(
      () => true,
      () => false,
    );
  if (!(await has('package.json'))) {
    io.log('info', `copying the starter into ${dir}`);
    await cp(starter, dir, {
      recursive: true,
      filter: (src) => !/[\\/](node_modules|\.next)([\\/]|$)/.test(src),
    });
  } else {
    await resetNonApp(dir, starter);
  }
  if (!(await has('node_modules'))) {
    io.log('info', 'installing dependencies (frozen lockfile, no install scripts)');
    await run('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], {
      cwd: dir,
      io,
      label: 'pnpm install',
    });
  }
  return dir;
}

/** The build the owner's checks rely on (D-128). The non-app files are put back first. */
export async function checkBuild(dir: string, io: RunIo, starter = STARTER): Promise<void> {
  await resetNonApp(dir, starter);
  await run('pnpm', ['build'], { cwd: dir, io, label: 'pnpm build' });
}

const PREVIEW_FILE = '.wpe-preview.json';
// Directories whose preview this worker started, so they stop when the worker does.
const started = new Set<string>();

/** True when a process command line is a `next dev` for this port (so a recycled pid is never signalled). */
export function isPreviewProcess(cmdline: string, port: number): boolean {
  const parts = cmdline.split('\0').filter((p) => p !== '');
  return parts.some((p) => /next/.test(p)) && parts.includes('dev') && parts.includes(String(port));
}

export async function previewRecord(dir: string): Promise<{ pid: number; port: number } | null> {
  const raw = await readFile(join(dir, PREVIEW_FILE), 'utf8').catch(() => null);
  if (!raw) return null;
  try {
    const { pid, port } = JSON.parse(raw) as { pid?: unknown; port?: unknown };
    // A plain integer above 1: pid 0 and negative numbers would address the worker's own group or everyone.
    if (!Number.isInteger(pid) || (pid as number) <= 1) return null;
    if (!Number.isInteger(port) || (port as number) < 1 || (port as number) > 65535) return null;
    return { pid: pid as number, port: port as number };
  } catch {
    return null;
  }
}

export async function stopPreview(dir: string): Promise<void> {
  const rec = await previewRecord(dir);
  if (rec) {
    // Linux (and WSL2): only a process that really is this preview server is stopped.
    const cmd = await readFile(`/proc/${rec.pid}/cmdline`, 'utf8').catch(() => null);
    if (cmd !== null && isPreviewProcess(cmd, rec.port)) killGroup(rec.pid);
  }
  await rm(join(dir, PREVIEW_FILE), { force: true });
  started.delete(dir);
}

/** Stops every preview this worker started; called when the worker shuts down. */
export async function stopAllPreviews(): Promise<void> {
  await Promise.allSettled([...started].map((d) => stopPreview(d)));
}

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = createServer();
    s.once('error', () => resolve(false));
    s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)));
  });
}

export async function freePort(from = 4100, to = 4199): Promise<number> {
  for (let p = from; p <= to; p++) if (await portFree(p)) return p;
  throw new Error(`no free port between ${from} and ${to} for the preview`);
}

/** Starts `next dev` on a free local port, detached so it outlives the run, and waits until it answers. */
export async function startPreview(dir: string, io: RunIo, waitMs = 90_000): Promise<string> {
  const port = await freePort();
  const out = await open(join(dir, '.wpe-preview.log'), 'a');
  const child = spawn('pnpm', ['exec', 'next', 'dev', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: dir,
    env: childEnv(),
    detached: true,
    stdio: ['ignore', out.fd, out.fd],
  });
  child.unref();
  await out.close();
  if (!child.pid) throw new Error('the preview server did not start');
  await writeFile(join(dir, PREVIEW_FILE), JSON.stringify({ pid: child.pid, port }));
  started.add(dir);
  const until = Date.now() + waitMs;
  while (Date.now() < until) {
    if (io.signal.aborted) {
      await stopPreview(dir);
      throw new Error('stopped');
    }
    io.progress();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return `http://localhost:${port}`;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 750));
  }
  await stopPreview(dir);
  throw new Error(
    `the preview server did not answer on port ${port} within ${waitMs / 1000} seconds`,
  );
}
