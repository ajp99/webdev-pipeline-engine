// What the Builder agent may touch (P2-T23). The prompt asks it to stay on the page; this code enforces it,
// because the PRD it reads is client text. Reads stay inside the project directory (never the env files or
// the preview records); writes go only under app/ (the page, its styles and layout), so the build and the
// dev server, which this worker runs as the owner, never execute code the agent wrote (D-310, G19).
import { basename, relative, resolve, sep } from 'node:path';

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

export function guardTool(dir: string, tool: string, input: Record<string, unknown>): ToolVerdict {
  const isRead = READ_TOOLS.has(tool);
  const isWrite = WRITE_TOOLS.has(tool);
  if (!isRead && !isWrite) return deny(`the ${tool} tool is not available to the Builder`);

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
      return deny(`${basename(p)} is not available to the Builder`);
    if (rel.split(sep).includes('node_modules') && isWrite)
      return deny('node_modules cannot be changed');
  }
  if (isWrite) {
    if (paths.length === 0) return deny('a write needs a file path');
    for (const p of paths) {
      const rel = inside(dir, p)!;
      if (!(rel === 'app' || rel.startsWith(`app${sep}`)) || !WRITABLE_EXT.test(rel))
        return deny(`the Builder may only write .tsx, .ts and .css files under app/, not ${p}`);
    }
  }
  return { allow: true };
}
