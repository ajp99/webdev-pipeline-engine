// Tests for docs-lint: each defect planted in a scratch tree must be reported, and a clean tree must pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lint } from './docs-lint.mjs';

const ROW = (n, status = 'Active') =>
  `| D-${String(n).padStart(3, '0')} | Area | Decision | Reason | ${status} |`;
const HEAD = '| ID | Area | Decision | Reason | Status |\n| --- | --- | --- | --- | --- |\n';

function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-lint-'));
  for (const [name, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), body);
  }
  return root;
}
const clean = () => ({
  'DECISIONS.md': HEAD + [1, 2, 3].map((n) => ROW(n)).join('\n') + '\n',
  'README.md': 'See [log](DECISIONS.md) and D-002.\n',
});

test('a clean tree passes', () => assert.deepEqual(lint(tree(clean())), []));
test('a gap in the decision IDs is reported', () => {
  const f = clean();
  f['DECISIONS.md'] = HEAD + [1, 3].map((n) => ROW(n)).join('\n') + '\n';
  assert.ok(lint(tree(f)).some((p) => p.includes('expected D-002, found D-003')));
});
test('a repeated decision ID is reported', () => {
  const f = clean();
  f['DECISIONS.md'] = HEAD + [1, 2, 2].map((n) => ROW(n)).join('\n') + '\n';
  assert.ok(lint(tree(f)).some((p) => p.includes('expected D-003, found D-002')));
});
test('a decision row with the wrong number of cells is reported', () => {
  const f = clean();
  f['DECISIONS.md'] += '| D-004 | Area | Decision | Active |\n';
  assert.ok(lint(tree(f)).some((p) => p.includes('D-004 has 4 cells')));
});
test('placeholder text is reported, but not inside code', () => {
  const f = clean();
  f['a.md'] = 'Decided in (D-?).\n';
  f['b.md'] = 'TBD later\n';
  f['c.md'] = '`(D-?)` and\n```\nTODO\n```\n';
  const p = lint(tree(f));
  assert.ok(p.some((x) => x.startsWith('a.md:1')));
  assert.ok(p.some((x) => x.startsWith('b.md:1')));
  assert.ok(!p.some((x) => x.startsWith('c.md')));
});
test('a reference to a decision that does not exist is reported', () => {
  const f = clean();
  f['a.md'] = 'See D-099.\n';
  assert.ok(lint(tree(f)).some((p) => p.includes('a.md:1: D-099 is not in DECISIONS.md')));
});
test('a broken relative link is reported; external and anchor links are not', () => {
  const f = clean();
  f['docs/a.md'] = '[x](missing.md) [y](https://example.com/x.md) [z](#top) [w](../README.md#a)\n';
  const p = lint(tree(f));
  assert.deepEqual(
    p.filter((x) => x.startsWith('docs/a.md')),
    ['docs/a.md:1: broken link missing.md'],
  );
});

const PLAN = (box, id = 'P1-T05') => `- [${box}] **${id} Something**  \n  Acceptance: x\n`;
const withPlan = (plan, progress) => ({
  ...clean(),
  'docs/plan/phase-1-x.md': plan,
  'docs/plan/PROGRESS.md': progress,
});

test('a ticked task with a progress entry passes', () =>
  assert.deepEqual(lint(tree(withPlan(PLAN('x'), '## 2026-10-21 P1-T05 Login\n- done\n'))), []));
test('a ticked task without a progress entry is reported', () => {
  const p = lint(tree(withPlan(PLAN('x'), '## 2026-10-21 P1-T06 Console\n- done\n')));
  assert.ok(p.some((m) => m.includes('P1-T05 is ticked but has no PROGRESS.md entry')));
});
test('unticked and moved tasks need no entry', () => {
  assert.deepEqual(lint(tree(withPlan(PLAN(' ') + PLAN('-', 'P1-T06'), '# Progress\n'))), []);
});
test('a grouped heading covers every task it lists', () => {
  const f = withPlan(
    PLAN('x', 'P1-T08') + PLAN('x', 'P1-T09'),
    '## 2026-10-21 P1-T02, T08 and T09 Evidence\n',
  );
  assert.deepEqual(lint(tree(f)), []);
});
test('taskIdsInHeading expands short forms', async () => {
  const { taskIdsInHeading } = await import('./docs-lint.mjs');
  assert.deepEqual(taskIdsInHeading('## d P2-T17, T01 and P1-T05 x'), [
    'P2-T17',
    'P2-T01',
    'P1-T05',
  ]);
});
