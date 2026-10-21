#!/usr/bin/env node
/* global process, console */
// Docs lint (P1-T14, D-291). Checks the markdown files for:
//   1. placeholder text such as "(D-?)", "D-??", TBD, TODO, FIXME
//   2. DECISIONS.md: IDs run D-001, D-002, ... with no gap, repeat or reordering, and every row has five cells
//   3. every D-NNN mentioned in a markdown file exists in DECISIONS.md
//   4. every relative markdown link points at a file or folder that exists
//   5. every ticked task in docs/plan/phase-*.md has a heading in docs/plan/PROGRESS.md naming it (D-315)
// Usage: node scripts/docs-lint.mjs [root]    Exits 1 and prints one line per problem.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  'backups',
]);
const PLACEHOLDER = /\(D-\?+\)|\bD-\?+|\bTBD\b|\bTODO\b|\bFIXME\b/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

// Removes fenced code blocks and inline code so examples are not linted.
function stripCode(text) {
  return text
    .replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));
}

// Task IDs named in a PROGRESS.md heading. "P1-T02, T08 and T09" counts as P1-T02, P1-T08, P1-T09.
export function taskIdsInHeading(heading) {
  const ids = [];
  let prefix = null;
  for (const m of heading.matchAll(/\b(?:(P\d[ab]?)-)?T(\d{2})\b/g)) {
    if (m[1]) prefix = m[1];
    if (prefix) ids.push(`${prefix}-T${m[2]}`);
  }
  return ids;
}

export function lint(root) {
  const problems = [];
  const files = walk(root);
  const rel = (f) => path.relative(root, f).split(path.sep).join('/');

  // 2. decision log
  let maxId = 0;
  const decisions = path.join(root, 'DECISIONS.md');
  if (fs.existsSync(decisions)) {
    let expected = 1;
    for (const [i, line] of fs.readFileSync(decisions, 'utf8').split('\n').entries()) {
      const m = line.match(/^\| D-(\d+) \|/);
      if (!m) continue;
      const n = Number(m[1]);
      if (n !== expected)
        problems.push(
          `DECISIONS.md:${i + 1}: expected D-${String(expected).padStart(3, '0')}, found D-${m[1]}`,
        );
      expected = n + 1;
      maxId = Math.max(maxId, n);
      const cells = line.replace(/\\\|/g, '').split('|').length - 2;
      if (cells !== 5)
        problems.push(`DECISIONS.md:${i + 1}: D-${m[1]} has ${cells} cells, expected 5`);
    }
  } else {
    problems.push('DECISIONS.md is missing');
  }

  for (const f of files) {
    const raw = fs.readFileSync(f, 'utf8');
    const text = stripCode(raw);
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      // 1. placeholders
      if (PLACEHOLDER.test(line)) problems.push(`${rel(f)}:${i + 1}: placeholder text`);
      // 3. decision references
      for (const m of line.matchAll(/\bD-(\d{3})\b/g)) {
        if (Number(m[1]) > maxId || Number(m[1]) < 1)
          problems.push(`${rel(f)}:${i + 1}: D-${m[1]} is not in DECISIONS.md`);
      }
      // 4. relative links
      for (const m of line.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
        const target = m[1];
        if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target)) continue;
        const p = decodeURIComponent(target.split('#')[0].split('?')[0]);
        if (!p) continue;
        const abs = p.startsWith('/') ? path.join(root, p) : path.resolve(path.dirname(f), p);
        if (!fs.existsSync(abs)) problems.push(`${rel(f)}:${i + 1}: broken link ${target}`);
      }
    });
  }

  // 5. ticked tasks need a progress entry (D-315)
  const progressFile = path.join(root, 'docs/plan/PROGRESS.md');
  const planDir = path.join(root, 'docs/plan');
  if (fs.existsSync(progressFile) && fs.existsSync(planDir)) {
    const logged = new Set(
      fs
        .readFileSync(progressFile, 'utf8')
        .split('\n')
        .filter((l) => l.startsWith('## '))
        .flatMap(taskIdsInHeading),
    );
    for (const name of fs.readdirSync(planDir).filter((n) => /^phase-.*\.md$/.test(n))) {
      const lines = fs.readFileSync(path.join(planDir, name), 'utf8').split('\n');
      lines.forEach((line, i) => {
        const m = line.match(/^- \[x\] \*\*(P\d[ab]?-T\d{2})\b/);
        if (m && !logged.has(m[1]))
          problems.push(
            `docs/plan/${name}:${i + 1}: ${m[1]} is ticked but has no PROGRESS.md entry`,
          );
      });
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(
    process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
  );
  const problems = lint(root);
  for (const p of problems) console.error(p);
  console.log(problems.length ? `docs-lint: ${problems.length} problem(s)` : 'docs-lint: ok');
  process.exit(problems.length ? 1 : 0);
}
