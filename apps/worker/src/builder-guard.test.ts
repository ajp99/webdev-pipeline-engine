import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { guardTool } from './builder-guard';
import { isPreviewProcess, previewRecord, resetNonApp, stopPreview } from './builder-host';

const dir = '/work/p1';
const ok = (tool: string, input: Record<string, unknown>) => guardTool(dir, tool, input).allow;

describe('guardTool: reads', () => {
  it('allows reading inside the project directory', () => {
    expect(ok('Read', { file_path: '/work/p1/app/page.tsx' })).toBe(true);
    expect(ok('Read', { file_path: 'app/page.tsx' })).toBe(true);
    expect(ok('Glob', { pattern: 'app/**/*.tsx' })).toBe(true);
    expect(ok('Grep', { pattern: 'Home', path: 'app' })).toBe(true);
  });
  it('refuses paths outside the directory, however they are written', () => {
    for (const p of [
      '/etc/passwd',
      '/root/.claude/.credentials.json',
      '../other/app/page.tsx',
      '/work/p1/../p2/app/page.tsx',
      '/work/p1-evil/app/page.tsx',
      '~/.ssh/id_rsa',
      '/work',
    ])
      expect(ok('Read', { file_path: p }), p).toBe(false);
  });
  it('refuses the env files and the preview records even inside the directory', () => {
    for (const p of ['.env', '.env.local', 'app/.env', '.wpe-preview.json', '.wpe-preview.log'])
      expect(ok('Read', { file_path: p }), p).toBe(false);
  });
  it('refuses a Glob or Grep that climbs out', () => {
    expect(ok('Glob', { pattern: '../**/*' })).toBe(false);
    expect(ok('Glob', { pattern: '/etc/*' })).toBe(false);
    expect(ok('Grep', { pattern: 'x', path: '/home' })).toBe(false);
    expect(ok('Grep', { pattern: 'x', glob: '../*.env' })).toBe(false);
  });
  it('refuses a path that is not text', () => {
    expect(ok('Read', { file_path: 5 })).toBe(false);
  });
});

describe('guardTool: writes', () => {
  it('allows the page, its styles and the layout', () => {
    for (const p of [
      'app/page.tsx',
      'app/globals.css',
      'app/layout.tsx',
      '/work/p1/app/about/page.tsx',
    ])
      expect(ok('Write', { file_path: p }), p).toBe(true);
    expect(ok('Edit', { file_path: 'app/page.tsx', old_string: 'a', new_string: 'b' })).toBe(true);
  });
  it('refuses every file that decides what runs, and anything outside app/', () => {
    for (const p of [
      'package.json',
      'next.config.ts',
      'postcss.config.mjs',
      'tsconfig.json',
      'pnpm-lock.yaml',
      '.npmrc',
      'node_modules/next/index.js',
      'public/x.tsx',
      'app/../package.json',
      'app/run.sh',
      'app/page.mjs',
      '/etc/cron.d/x',
      '/work/p1/app',
    ])
      expect(ok('Write', { file_path: p }), p).toBe(false);
  });
  it('refuses a write with no path', () => {
    expect(ok('Write', {})).toBe(false);
  });
});

describe('guardTool: tools', () => {
  it('refuses every other tool', () => {
    for (const t of [
      'Bash',
      'WebFetch',
      'WebSearch',
      'Task',
      'NotebookEdit',
      'KillShell',
      'mcp__x__y',
    ])
      expect(ok(t, {}), t).toBe(false);
  });
});

describe('preview process safety', () => {
  it('knows a next dev server for the port and nothing else', () => {
    const cmd = [
      'node',
      '/w/node_modules/next/dist/bin/next',
      'dev',
      '-p',
      '4100',
      '-H',
      '127.0.0.1',
      '',
    ].join('\0');
    expect(isPreviewProcess(cmd, 4100)).toBe(true);
    expect(isPreviewProcess(cmd, 4101)).toBe(false);
    expect(isPreviewProcess(['bash', '-c', 'sleep 9'].join('\0'), 4100)).toBe(false);
    expect(isPreviewProcess(['node', 'next', 'build'].join('\0'), 4100)).toBe(false);
    expect(isPreviewProcess('', 4100)).toBe(false);
  });
});

describe('on-disk rules', () => {
  const made: string[] = [];
  afterEach(async () => {
    for (const d of made.splice(0)) await rm(d, { recursive: true, force: true });
  });
  const temp = async () => {
    const d = await mkdtemp(join(tmpdir(), 'wpe-test-'));
    made.push(d);
    return d;
  };

  it('stopPreview ignores a record with a pid that could hit the worker or everyone, and removes it', async () => {
    for (const pid of [0, 1, -1, 1.5, '12', null]) {
      const d = await temp();
      await writeFile(join(d, '.wpe-preview.json'), JSON.stringify({ pid, port: 4100 }));
      await expect(stopPreview(d)).resolves.toBeUndefined();
      expect(await readdir(d)).not.toContain('.wpe-preview.json');
    }
  });
  it('reads a preview record only when pid and port are plain, usable numbers', async () => {
    const read = async (rec: unknown) => {
      const d = await temp();
      await writeFile(join(d, '.wpe-preview.json'), JSON.stringify(rec));
      return previewRecord(d);
    };
    expect(await read({ pid: 4242, port: 4100 })).toEqual({ pid: 4242, port: 4100 });
    for (const pid of [0, 1, -1, 1.5, '12', null, 2 ** 40 + 0.5])
      expect(await read({ pid, port: 4100 }), String(pid)).toBeNull();
    for (const port of [0, -1, 70000, 4100.5, '4100', null])
      expect(await read({ pid: 4242, port }), String(port)).toBeNull();
  });
  it('stopPreview survives a damaged or missing record', async () => {
    const d = await temp();
    await writeFile(join(d, '.wpe-preview.json'), 'not json');
    await expect(stopPreview(d)).resolves.toBeUndefined();
    await expect(stopPreview(await temp())).resolves.toBeUndefined();
  });

  it('resetNonApp restores the starter files, removes strangers, and leaves app/ and install output', async () => {
    const starter = await temp();
    await mkdir(join(starter, 'app'));
    await writeFile(join(starter, 'package.json'), '{"name":"good"}');
    await writeFile(join(starter, 'next.config.ts'), 'export default {};');
    await writeFile(join(starter, 'app/page.tsx'), 'starter page');
    const d = await temp();
    await mkdir(join(d, 'app'));
    await mkdir(join(d, 'node_modules'));
    await mkdir(join(d, 'scripts'));
    await writeFile(join(d, 'package.json'), '{"name":"evil","scripts":{"build":"curl x"}}');
    await writeFile(join(d, 'next.config.ts'), 'fetch("http://evil")');
    await writeFile(join(d, 'postinstall.sh'), 'rm -rf ~');
    await writeFile(join(d, 'scripts/x.js'), 'x');
    await writeFile(join(d, 'app/page.tsx'), 'the Builder page');
    await resetNonApp(d, starter);
    expect(await readFile(join(d, 'package.json'), 'utf8')).toBe('{"name":"good"}');
    expect(await readFile(join(d, 'next.config.ts'), 'utf8')).toBe('export default {};');
    expect(await readFile(join(d, 'app/page.tsx'), 'utf8')).toBe('the Builder page');
    const left = (await readdir(d)).sort();
    expect(left).toEqual(['app', 'next.config.ts', 'node_modules', 'package.json']);
  });
});
