// The git side of a build round (D-332): rounds are local `round-N` branches of the site repository the
// prototype created, compared with and merged into `staging`. Nothing here resets or deletes the owner's work.
import { execFile } from 'node:child_process';
import { readdir, readFile, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { ROUND_BACKLOG_FILE } from '@wpe/shared';
import type { RunIo } from './builder';
import { run, workDirFor, workRoot } from './builder-host';

/** Git with its output captured; throws with git's message on failure. */
export function gitOut(dir: string, ...args: string[]): Promise<string> {
  return new Promise((ok, fail) =>
    execFile('git', args, { cwd: dir, maxBuffer: 20 * 1024 * 1024 }, (e, out, err) =>
      e ? fail(new Error(`git ${args[0]}: ${(err || e.message).trim()}`)) : ok(out),
    ),
  );
}
const head = async (dir: string) => (await gitOut(dir, 'rev-parse', 'HEAD')).trim();

/** The project's site repository on `staging`, with dependencies installed. The prototype must have made it. */
export async function prepareRoundRepo(
  projectId: string,
  io: RunIo,
  root = workRoot(),
): Promise<string> {
  const dir = join(workDirFor(projectId, root), 'site');
  try {
    await gitOut(dir, 'rev-parse', '--verify', 'staging');
  } catch {
    throw new Error(
      `there is no site repository with a staging branch in ${dir}: the prototype stage makes it`,
    );
  }
  const dirty = (await gitOut(dir, 'status', '--porcelain')).trim();
  if (dirty) {
    // A run that stopped half-way left changes: they are kept as a commit on the branch they were made on.
    await gitOut(dir, 'add', '-A');
    await gitOut(dir, 'commit', '-q', '-m', 'Work left by a stopped run');
    io.log('warn', 'kept the changes a stopped run left, as a commit');
  }
  await gitOut(dir, 'checkout', '-q', 'staging');
  try {
    await readdir(join(dir, 'node_modules'));
  } catch {
    io.log('info', 'installing dependencies (frozen lockfile)');
    await run('pnpm', ['install', '--frozen-lockfile', '--ignore-workspace'], {
      cwd: dir,
      io,
      label: 'pnpm install',
    });
  }
  return dir;
}

/** Merges round-N into staging with a merge commit and returns its id; a round already in staging is not merged again. */
export async function mergeRound(dir: string, round: number, io: RunIo): Promise<string> {
  const branch = `round-${round}`;
  await gitOut(dir, 'checkout', '-q', 'staging');
  try {
    await gitOut(dir, 'merge-base', '--is-ancestor', branch, 'staging');
    // Already merged: the commit that brought it in.
    const merges = (
      await gitOut(dir, 'log', '--merges', '--format=%H', `--grep=^Merge ${branch}$`, 'staging')
    ).trim();
    return merges.split('\n')[0] || (await head(dir));
  } catch (e) {
    if (e instanceof Error && /unknown revision|not a valid/.test(e.message))
      throw new Error(`there is no branch ${branch}`);
  }
  await gitOut(dir, 'merge', '--no-ff', '-q', '-m', `Merge ${branch}`, branch);
  io.log('info', `merged ${branch} into staging`);
  return head(dir);
}

/** Switches to the round's branch, creating it from staging; an existing branch first takes in staging. */
export async function roundBranch(dir: string, name: string, io: RunIo): Promise<void> {
  const exists = await gitOut(dir, 'rev-parse', '--verify', '-q', name).then(
    () => true,
    () => false,
  );
  if (!exists) {
    await gitOut(dir, 'checkout', '-q', '-b', name, 'staging');
    io.log('info', `created ${name} from staging`);
    return;
  }
  await gitOut(dir, 'checkout', '-q', name);
  await gitOut(dir, 'merge', '-q', '--no-edit', 'staging');
}

/** Commits everything on the current branch and returns the commit id. */
export async function commitRound(dir: string, _io: RunIo, message: string): Promise<string> {
  await gitOut(dir, 'add', '-A');
  await gitOut(dir, 'commit', '-q', '--allow-empty', '-m', message);
  return head(dir);
}

/** Reads the Builder's backlog file and removes it, so it is never committed or read twice. */
export async function takeBacklog(dir: string): Promise<string> {
  const path = join(dir, ROUND_BACKLOG_FILE);
  const text = await readFile(path, 'utf8').catch(() => '');
  await rm(path, { force: true });
  return text;
}

/** What the round changed against staging: files with line counts, and the NOTES.md diff (D-267). */
export async function roundDiff(
  dir: string,
): Promise<{ files: { path: string; added: number; removed: number }[]; notes: string }> {
  const stat = await gitOut(dir, 'diff', '--numstat', 'staging...HEAD');
  const files = stat
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [a, r, ...p] = l.split('\t');
      return { path: p.join('\t'), added: Number(a) || 0, removed: Number(r) || 0 };
    });
  const notes = await gitOut(dir, 'diff', 'staging...HEAD', '--', '.pipeline/NOTES.md');
  return { files, notes };
}

/** Every <Claim> marker in the site's content and components, with its file and text (P4-T05, D-143). */
export async function listClaims(dir: string): Promise<{ file: string; text: string }[]> {
  const out: { file: string; text: string }[] = [];
  const walk = async (d: string): Promise<void> => {
    for (const e of await readdir(d, { withFileTypes: true }).catch(() => [])) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && !e.name.startsWith('.')) await walk(p);
      } else if (/\.(mdx|tsx)$/.test(e.name)) {
        const text = await readFile(p, 'utf8');
        for (const m of text.matchAll(/<Claim(?:\s[^>]*)?>([\s\S]*?)<\/Claim>/g))
          out.push({
            file: relative(dir, p),
            text: m[1]!.replace(/\s+/g, ' ').trim().slice(0, 500),
          });
      }
    }
  };
  for (const top of ['content', 'components', 'app']) await walk(join(dir, top));
  return out;
}

/** The checks a round must pass before review (P4-T02): the starter's build, typecheck and content schema. */
export async function roundChecks(dir: string, io: RunIo): Promise<void> {
  for (const script of ['build', 'typecheck', 'check:content'])
    await run('pnpm', [script], { cwd: dir, io, label: `pnpm ${script}` });
}
