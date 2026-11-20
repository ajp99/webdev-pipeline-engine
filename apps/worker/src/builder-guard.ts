// What an agent may touch (P2-T23, P3-T04). The prompt asks it to stay in its files; this code enforces it,
// because what it reads is client text. Reads stay inside the project directory (never the env files or the
// preview records); writes go only to the files its policy names. Those files are code the worker then builds
// and serves as the owner (the Builder's app/ files; the Prototype agent's section components, fonts, CSS and
// MDX), with HOME set: an accepted risk only while every client is fictional (D-310, go-live item G19).
import { basename, join, relative, resolve, sep } from 'node:path';

export type ToolVerdict = { allow: true } | { allow: false; reason: string };

const READ_TOOLS = new Set(['Read', 'Glob', 'Grep']);
const WRITE_TOOLS = new Set(['Write', 'Edit']);
const WRITABLE_EXT = /\.(tsx|ts|css)$/;
const HIDDEN_FILE = /^(\.env.*|\.wpe-.*)$/;

const deny = (reason: string): ToolVerdict => ({ allow: false, reason });

/** Where inside `dir` a path points, as a relative path, or null when it leaves the directory. */
function inside(dir: string, p: string): string | null {
  const rel = relative(dir, resolve(dir, p));
  if (rel === '') return '';
  if (rel === '..' || rel.startsWith(`..${sep}`) || resolve(rel) === rel) return null;
  return rel;
}

/** Which files an agent may write: a relative path test and the words for a refusal. */
export type WritePolicy = { agent: string; canWrite: (rel: string) => boolean; rule: string };

/** The Builder (walking skeleton): .tsx, .ts and .css files under app/. */
export const BUILDER_WRITES: WritePolicy = {
  agent: 'Builder',
  canWrite: (rel) => (rel === 'app' || rel.startsWith(`app${sep}`)) && WRITABLE_EXT.test(rel),
  rule: '.tsx, .ts and .css files under app/',
};

/**
 * The Prototype agent (P3-T04): the page content and settings (content/**.mdx and .json), the section
 * components (components/sections/**.tsx) and the brand (app/globals.css, app/fonts.ts). Everything else in the
 * starter (the contact route, the content loader, the build configuration) is put back before every run.
 */
export const PROTOTYPE_WRITES: WritePolicy = {
  agent: 'Prototype agent',
  canWrite: (rel) => {
    const parts = rel.split(sep);
    if (parts[0] === 'content') return /\.(mdx|json)$/.test(rel);
    if (parts[0] === 'components' && parts[1] === 'sections')
      return parts.length === 3 && /\.tsx$/.test(rel);
    return rel === join('app', 'globals.css') || rel === join('app', 'fonts.ts');
  },
  rule: 'content/ (.mdx, .json), components/sections/ (.tsx), app/globals.css and app/fonts.ts',
};

export function guardTool(
  dir: string,
  tool: string,
  input: Record<string, unknown>,
  policy: WritePolicy = BUILDER_WRITES,
): ToolVerdict {
  const isRead = READ_TOOLS.has(tool);
  const isWrite = WRITE_TOOLS.has(tool);
  if (!isRead && !isWrite) return deny(`the ${tool} tool is not available to the ${policy.agent}`);

  // Every path-like input must stay inside the directory. Glob patterns and Grep globs count too.
  const paths: string[] = [];
  for (const k of ['file_path', 'path', 'notebook_path']) {
    const v = input[k];
    if (v !== undefined && v !== null) {
      if (typeof v !== 'string') return deny(`${k} must be a text path`);
      paths.push(v);
    }
  }
  if (tool === 'Glob' && typeof input.pattern === 'string')
    paths.push(input.pattern.replace(/[*?[\]{}].*$/, ''));
  if (tool === 'Grep' && typeof input.glob === 'string' && /(^|\/)\.\.(\/|$)/.test(input.glob))
    return deny('a glob may not leave the project directory');
  if (
    typeof input.pattern === 'string' &&
    tool === 'Glob' &&
    /(^|\/)\.\.(\/|$)/.test(input.pattern)
  )
    return deny('a pattern may not leave the project directory');

  for (const p of paths) {
    // A tool may expand a leading ~ to the home directory, so it is never read as a plain relative path.
    if (p.startsWith('~')) return deny(`${p} is outside the project directory`);
    const rel = inside(dir, p);
    if (rel === null) return deny(`${p} is outside the project directory`);
    if (rel.split(sep).some((part) => HIDDEN_FILE.test(part)))
      return deny(`${basename(p)} is not available to the ${policy.agent}`);
    if (rel.split(sep).includes('node_modules') && isWrite)
      return deny('node_modules cannot be changed');
  }
  if (isWrite) {
    if (paths.length === 0) return deny('a write needs a file path');
    for (const p of paths) {
      const rel = inside(dir, p)!;
      if (!policy.canWrite(rel))
        return deny(`the ${policy.agent} may only write ${policy.rule}, not ${p}`);
    }
  }
  return { allow: true };
}
