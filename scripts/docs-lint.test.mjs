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
