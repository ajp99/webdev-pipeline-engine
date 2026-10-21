#!/usr/bin/env node
/* global process, console, fetch */
// pnpm run doctor (P2-T17; plain `pnpm doctor` is pnpm's own built-in command and prints nothing): reports whether this machine is set up for local development.
// Reports only: it changes nothing, creates no users and never prints a key or password.
// Checks: Node version, git hooks, env files, the local Supabase (reachable, email provider on,
// public sign-ups off), every table from the migrations present, and the owner row.
// Usage: node scripts/doctor.mjs [root]    Exits 1 when any check fails; warnings do not fail.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function parseEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

export function tablesFromMigrations(sql) {
  return [...sql.matchAll(/^create table (?:public\.)?([a-z_]+)\s*\(/gim)].map((m) => m[1]);
}

const ok = (name) => ({ level: 'ok', name });
const warn = (name, hint) => ({ level: 'warn', name, hint });
const fail = (name, hint) => ({ level: 'fail', name, hint });

// deps: { root, readFile(path) -> string | null, listMigrations() -> string[], fetch, nodeVersion, hooksPath }
export async function runChecks(deps) {
  const results = [];
  const read = (rel) => deps.readFile(path.join(deps.root, rel));

  // Node and git hooks
  const major = Number(String(deps.nodeVersion).replace(/^v/, '').split('.')[0]);
  results.push(
    major >= 22
      ? ok(`Node ${deps.nodeVersion}`)
      : fail(`Node ${deps.nodeVersion}`, 'Node 22 or newer is needed (see .nvmrc)'),
  );
  results.push(
    deps.hooksPath === '.githooks'
      ? ok('git hooks path is .githooks')
      : fail('git hooks path', 'run: git config core.hooksPath .githooks'),
  );

  // Env files
  const webText = read('apps/web/.env.local');
  const workerText = read('apps/worker/.env');
  const web = webText === null ? null : parseEnv(webText);
  const worker = workerText === null ? null : parseEnv(workerText);
  if (!web) {
    results.push(
      fail('apps/web/.env.local', 'missing: run scripts/setup-env.sh (or see owner steps, step 4)'),
    );
  } else {
    const missing = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'].filter(
      (k) => !web[k],
    );
    results.push(
      missing.length
        ? fail('apps/web/.env.local', `missing ${missing.join(', ')}`)
        : ok('apps/web/.env.local has the URL and anon key'),
    );
    const secrets = Object.keys(web).filter((k) => /SERVICE_ROLE|ANTHROPIC|GITHUB|VERCEL/.test(k));
    if (secrets.length)
      results.push(
        fail(
          'apps/web must hold no worker secrets',
          `remove ${secrets.join(', ')} from .env.local`,
        ),
      );
  }
  if (!worker) {
    results.push(
      fail('apps/worker/.env', 'missing: run scripts/setup-env.sh (or owner steps, step 4)'),
    );
  } else {
    const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !worker[k]);
    results.push(
      missing.length
        ? fail('apps/worker/.env', `missing ${missing.join(', ')}`)
        : ok('apps/worker/.env has the URL and service role key'),
    );
    if (worker.OWNER_PASSWORD)
      results.push(
        warn(
          'OWNER_PASSWORD is still in apps/worker/.env',
          'delete that line after bootstrap-owner',
        ),
      );
    if (!worker.ANTHROPIC_API_KEY)
      results.push(
        warn('ANTHROPIC_API_KEY is empty', 'needed before the intake agent (P2-T05), D-313'),
      );
  }

  // Local Supabase
  const url = web?.NEXT_PUBLIC_SUPABASE_URL;
  const anon = web?.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return results;
  let settings;
  try {
    const res = await deps.fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    settings = await res.json();
    results.push(ok('Supabase is reachable'));
  } catch (e) {
    results.push(fail('Supabase is not reachable', `run: supabase start (${e.message})`));
    return results;
  }
  results.push(
    settings.external?.email === true
      ? ok('email provider is on (the owner can sign in)')
      : fail(
          'email provider is off',
          'set [auth.email] enable_signup = true in supabase/config.toml and restart',
        ),
  );
  results.push(
    settings.disable_signup === true
      ? ok('public sign-ups are off')
      : fail('public sign-ups are ON', 'set [auth] enable_signup = false and restart Supabase'),
  );

  // Migrations applied, owner row (read with the service key, never printed)
  const key = worker?.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return results;
  const expected = deps.listMigrations().flatMap((sql) => tablesFromMigrations(sql));
  try {
    const res = await deps.fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const spec = await res.json();
    const have = new Set(Object.keys(spec.paths ?? {}).map((p) => p.replace(/^\//, '')));
    const absent = expected.filter((t) => !have.has(t));
    results.push(
      absent.length
        ? fail(`migrations not applied (${absent.length} tables missing)`, 'run: supabase db reset')
        : ok(`all ${expected.length} tables from the migrations exist`),
    );
  } catch (e) {
    results.push(
      fail('could not read the database schema', `check the service key (${e.message})`),
    );
    return results;
  }
  try {
    const res = await deps.fetch(`${url}/rest/v1/owners?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const rows = res.ok ? await res.json() : [];
    results.push(
      rows.length
        ? ok('an owner login exists')
        : fail('no owner login yet', 'run: pnpm --filter @wpe/worker bootstrap-owner'),
    );
  } catch (e) {
    results.push(fail('could not read the owners table', e.message));
  }
  return results;
}

export function render(results) {
  const mark = { ok: 'ok  ', warn: 'warn', fail: 'FAIL' };
  const lines = results.map(
    (r) => `${mark[r.level]}  ${r.name}${r.hint ? `\n        -> ${r.hint}` : ''}`,
  );
  const fails = results.filter((r) => r.level === 'fail').length;
  const warns = results.filter((r) => r.level === 'warn').length;
  lines.push(
    '',
    fails ? `doctor: ${fails} problem(s), ${warns} warning(s)` : `doctor: ok (${warns} warning(s))`,
  );
  return { text: lines.join('\n'), failed: fails > 0 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(
    process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
  );
  let hooksPath = '';
  try {
    hooksPath = execFileSync('git', ['config', 'core.hooksPath'], { cwd: root }).toString().trim();
  } catch {
    /* unset */
  }
  const migDir = path.join(root, 'supabase/migrations');
  const results = await runChecks({
    root,
    nodeVersion: process.version,
    hooksPath,
    fetch,
    readFile: (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null),
    listMigrations: () =>
      fs
        .readdirSync(migDir)
        .filter((f) => f.endsWith('.sql'))
        .sort()
        .map((f) => fs.readFileSync(path.join(migDir, f), 'utf8')),
  });
  const { text, failed } = render(results);
  console.log(text);
  process.exit(failed ? 1 : 0);
}
