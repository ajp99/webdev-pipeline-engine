// Tests for pnpm run doctor: each defect planted in the fake machine must be reported, a good one must pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv, tablesFromMigrations, runChecks, render } from './doctor.mjs';

const SQL = 'create table owners (\n id int\n);\ncreate table projects (\n id int\n);\n';
const SECRET = 'SECRET-SERVICE-KEY-VALUE';

function machine(over = {}) {
  const files = {
    '/r/apps/web/.env.local':
      'NEXT_PUBLIC_SUPABASE_URL=http://x\nNEXT_PUBLIC_SUPABASE_ANON_KEY=ANON-KEY-VALUE\n',
    '/r/apps/worker/.env': `SUPABASE_URL=http://x\nSUPABASE_SERVICE_ROLE_KEY=${SECRET}\nMODEL_PROVIDER=gemini\nMODEL_NAME=m\nGEMINI_API_KEY=k\n`,
    ...over.files,
  };
  for (const [k, v] of Object.entries(files)) if (v === null) delete files[k];
  const settings = over.settings ?? { external: { email: true }, disable_signup: true };
  const tables = over.tables ?? ['owners', 'projects'];
  const owners = over.owners ?? [{ id: 'u1' }];
  const respond = (body, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body });
  return {
    root: '/r',
    nodeVersion: over.nodeVersion ?? 'v22.1.0',
    hooksPath: over.hooksPath ?? '.githooks',
    readFile: (p) => files[p] ?? null,
    listMigrations: () => [SQL],
    fetch: async (u) => {
      if (over.down) throw new Error('ECONNREFUSED');
      if (u.endsWith('/auth/v1/settings')) return respond(settings);
      if (u.endsWith('/rest/v1/'))
        return respond({ paths: Object.fromEntries(tables.map((t) => [`/${t}`, {}])) });
      if (u.includes('/rest/v1/owners')) return respond(owners);
      return respond({}, false);
    },
  };
}
const levels = (rs) => rs.map((r) => r.level);
const names = (rs, l) => rs.filter((r) => r.level === l).map((r) => r.name);

test('parseEnv reads values, ignores comments, strips quotes', () => {
  assert.deepEqual(parseEnv('# c\nA=1\nB="two"\n C = 3 \n'), { A: '1', B: 'two', C: '3' });
});
test('tablesFromMigrations finds each created table', () =>
  assert.deepEqual(tablesFromMigrations(SQL), ['owners', 'projects']));
test('a good machine passes with no failures', async () => {
  const rs = await runChecks(machine());
  assert.ok(!levels(rs).includes('fail'), JSON.stringify(rs));
});
test('old Node and a missing hooks path fail', async () => {
  const rs = await runChecks(machine({ nodeVersion: 'v20.0.0', hooksPath: '' }));
  assert.equal(names(rs, 'fail').length, 2);
});
test('missing env files fail', async () => {
  const rs = await runChecks(
    machine({ files: { '/r/apps/web/.env.local': null, '/r/apps/worker/.env': null } }),
  );
  assert.deepEqual(names(rs, 'fail'), ['apps/web/.env.local', 'apps/worker/.env']);
});
test('a worker secret in the web env fails', async () => {
  const rs = await runChecks(
    machine({
      files: {
        '/r/apps/web/.env.local':
          'NEXT_PUBLIC_SUPABASE_URL=u\nNEXT_PUBLIC_SUPABASE_ANON_KEY=a\nSUPABASE_SERVICE_ROLE_KEY=s\n',
      },
    }),
  );
  assert.ok(names(rs, 'fail').includes('apps/web must hold no worker secrets'));
});
test('a leftover OWNER_PASSWORD only warns', async () => {
  const rs = await runChecks(
    machine({
      files: {
        '/r/apps/worker/.env': `SUPABASE_URL=u\nSUPABASE_SERVICE_ROLE_KEY=${SECRET}\nMODEL_PROVIDER=gemini\nMODEL_NAME=m\nGEMINI_API_KEY=k\nOWNER_PASSWORD=pw\n`,
      },
    }),
  );
  assert.deepEqual(names(rs, 'warn'), ['OWNER_PASSWORD is still in apps/worker/.env']);
  assert.ok(!levels(rs).includes('fail'));
});
const workerEnv = (extra) => ({
  '/r/apps/worker/.env': `SUPABASE_URL=u\nSUPABASE_SERVICE_ROLE_KEY=${SECRET}\n${extra}`,
});
test('no model provider only warns', async () => {
  const rs = await runChecks(machine({ files: workerEnv('') }));
  assert.deepEqual(names(rs, 'warn'), ['MODEL_PROVIDER is empty']);
  assert.ok(!levels(rs).includes('fail'));
});
test('a provider without its key, or with an unknown name, warns', async () => {
  let rs = await runChecks(machine({ files: workerEnv('MODEL_PROVIDER=gemini\nMODEL_NAME=m\n') }));
  assert.deepEqual(names(rs, 'warn'), ['GEMINI_API_KEY is empty']);
  rs = await runChecks(
    machine({ files: workerEnv('MODEL_PROVIDER=anthropic\nMODEL_NAME=m\nGEMINI_API_KEY=k\n') }),
  );
  assert.deepEqual(names(rs, 'warn'), ['ANTHROPIC_API_KEY is empty']);
  rs = await runChecks(machine({ files: workerEnv('MODEL_PROVIDER=nope\nMODEL_NAME=m\n') }));
  assert.deepEqual(names(rs, 'warn'), ['MODEL_PROVIDER "nope" is not known']);
});
test('a provider with a key but no model name warns', async () => {
  const rs = await runChecks(
    machine({ files: workerEnv('MODEL_PROVIDER=gemini\nGEMINI_API_KEY=k\n') }),
  );
  assert.deepEqual(names(rs, 'warn'), ['MODEL_NAME is empty']);
});
test('a Gemini key in the web env fails', async () => {
  const rs = await runChecks(
    machine({
      files: {
        '/r/apps/web/.env.local':
          'NEXT_PUBLIC_SUPABASE_URL=u\nNEXT_PUBLIC_SUPABASE_ANON_KEY=a\nGEMINI_API_KEY=g\n',
      },
    }),
  );
  assert.ok(names(rs, 'fail').includes('apps/web must hold no worker secrets'));
});
test('Supabase down is one failure and stops the database checks', async () => {
  const rs = await runChecks(machine({ down: true }));
  assert.ok(names(rs, 'fail').includes('Supabase is not reachable'));
  assert.ok(!rs.some((r) => r.name.includes('tables')));
});
test('sign-ups on, and email provider off, each fail', async () => {
  assert.ok(
    names(
      await runChecks(machine({ settings: { external: { email: true }, disable_signup: false } })),
      'fail',
    ).includes('public sign-ups are ON'),
  );
  assert.ok(
    names(
      await runChecks(machine({ settings: { external: { email: false }, disable_signup: true } })),
      'fail',
    ).includes('email provider is off'),
  );
});
test('missing tables and a missing owner fail', async () => {
  assert.ok(
    names(await runChecks(machine({ tables: ['owners'] })), 'fail').some((n) =>
      n.startsWith('migrations not applied (1 '),
    ),
  );
  assert.ok(names(await runChecks(machine({ owners: [] })), 'fail').includes('no owner login yet'));
});
test('the report never contains a key', async () => {
  const { text } = render(await runChecks(machine({ owners: [], tables: [] })));
  assert.ok(!text.includes(SECRET) && !text.includes('ANON-KEY-VALUE'));
});
test('render exits failed only when something failed', async () => {
  assert.equal(render(await runChecks(machine())).failed, false);
  assert.equal(render(await runChecks(machine({ owners: [] }))).failed, true);
});
