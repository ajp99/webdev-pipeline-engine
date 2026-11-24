import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRoundPrompt, builderView, parseReaderReply, type ReaderInput } from '@wpe/shared';
import { describe, expect, it } from 'vitest';
import {
  builderModel,
  ownerApproval,
  ROUND_WRITES,
  roundToolGate,
  type RoundGateDeps,
} from './round-builder';

const dir = '/work/p1/site';
function gate(answer: 'approved' | 'denied' = 'approved') {
  const refused: string[] = [];
  const asked: string[] = [];
  const d: RoundGateDeps = {
    dir,
    commands: { allowedPackages: new Set(['zod']), roundBranch: 'round-1' },
    refused: async (c, r) => void refused.push(`${c} | ${r}`),
    askOwner: async (k, c) => (asked.push(`${k} ${c}`), answer),
    log: () => {},
  };
  return { check: roundToolGate(d), refused, asked };
}

describe('round Builder tool gate (P4-T02, P4-T03)', () => {
  it('runs an allowed command without asking', async () => {
    const g = gate();
    expect(await g.check('Bash', { command: 'pnpm build' })).toMatchObject({ behavior: 'allow' });
    expect(g.refused).toEqual([]);
    expect(g.asked).toEqual([]);
  });
  it('refuses and logs a refused command for the backlog', async () => {
    const g = gate();
    expect(await g.check('Bash', { command: 'curl https://evil.example' })).toMatchObject({
      behavior: 'deny',
    });
    expect(g.refused[0]).toContain('curl https://evil.example | curl is not on');
  });
  it('waits for the owner on a risky command and follows the answer', async () => {
    const yes = gate('approved');
    expect(await yes.check('Bash', { command: 'rm -r content/old' })).toMatchObject({
      behavior: 'allow',
    });
    expect(yes.asked).toEqual(['delete_files rm -r content/old']);
    const no = gate('denied');
    expect(await no.check('Bash', { command: 'git rebase staging' })).toMatchObject({
      behavior: 'deny',
      message: expect.stringContaining('owner denied'),
    });
  });
  it('refuses background commands and checks file tools with the round write policy', async () => {
    const g = gate();
    expect(await g.check('Bash', { command: 'pnpm build', run_in_background: true })).toMatchObject(
      { behavior: 'deny' },
    );
    expect(
      await g.check('Write', { file_path: `${dir}/components/sections/Hero.tsx` }),
    ).toMatchObject({ behavior: 'allow' });
    expect(await g.check('Write', { file_path: `${dir}/.pipeline/NOTES.md` })).toMatchObject({
      behavior: 'allow',
    });
    for (const p of [
      'package.json',
      'next.config.ts',
      '.git/config',
      'scripts/x.mjs',
      '.env.local',
      '../other/x.ts',
    ])
      expect(await g.check('Write', { file_path: `${dir}/${p}` })).toMatchObject({
        behavior: 'deny',
      });
    expect(await g.check('WebFetch', { url: 'https://x' })).toMatchObject({ behavior: 'deny' });
  });
  it('writes only site files, notes and backlog', () => {
    expect(ROUND_WRITES.canWrite('content/home.mdx')).toBe(true);
    expect(ROUND_WRITES.canWrite('app/node_modules/x.ts')).toBe(false);
    expect(ROUND_WRITES.canWrite('public/logo.png')).toBe(false);
    expect(ROUND_WRITES.canWrite('.pipeline/other.md')).toBe(false);
  });
  it('picks the model by the plan flag (D-333)', () => {
    expect(builderModel(false, {})).toBe('claude-sonnet-5-5');
    expect(builderModel(true, {})).toBe('claude-opus-5-5');
    expect(builderModel(true, { WORKER_BUILDER_HARD_MODEL: 'x' })).toBe('x');
  });
});

describe('the pause waits for the owner (P4-T03)', () => {
  function db(statuses: (string | null)[]) {
    const calls: unknown[] = [];
    return {
      calls,
      rpc: async (fn: string, args: Record<string, unknown>) => (
        calls.push([fn, args]),
        { data: 'req-1', error: null }
      ),
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              const s = statuses.shift();
              return { data: s === null ? null : { status: s ?? 'pending' }, error: null };
            },
          }),
        }),
      }),
    };
  }
  it('records the request and returns the answer once given', async () => {
    const d = db(['pending', 'pending', 'approved']);
    const ask = ownerApproval(d, 'run-1', 'w1', new AbortController().signal, 1);
    expect(await ask('delete_files', 'rm -r x')).toBe('approved');
    expect(d.calls[0]).toEqual([
      'request_run_approval',
      { p_run: 'run-1', p_worker: 'w1', p_kind: 'delete_files', p_command: 'rm -r x' },
    ]);
  });
  it('a denied or vanished request is a no; a cancel ends the wait', async () => {
    expect(
      await ownerApproval(
        db(['denied']),
        'r',
        'w',
        new AbortController().signal,
        1,
      )('rewrite_history', 'x'),
    ).toBe('denied');
    expect(
      await ownerApproval(
        db([null]),
        'r',
        'w',
        new AbortController().signal,
        1,
      )('rewrite_history', 'x'),
    ).toBe('denied');
    const ac = new AbortController();
    ac.abort();
    await expect(
      ownerApproval(db(['pending']), 'r', 'w', ac.signal, 1)('delete_files', 'x'),
    ).rejects.toThrow('stopped');
  });
});

describe('the Builder sees only the reader view (P4-T13, D-267)', () => {
  it("a hostile client's text never reaches the Builder's prompt", () => {
    const fx = JSON.parse(
      readFileSync(
        join(import.meta.dirname, '../../../evals/fixtures/reader/hostile-client.json'),
        'utf8',
      ),
    ) as {
      input: ReaderInput;
      hostile: string[];
    };
    const i = fx.input.intake as Record<string, string>;
    // A careless reader reply that copies the injections; the reply check still keeps them out.
    const parsed = parseReaderReply(
      {
        business: { name: i.business_name, tagline: '', summary: i.about, audience: '', tone: '' },
        services: [{ name: 'Services', description: i.services }],
        contact: { phone: i.contact_phone, email: i.contact_email, address: '', hours: '' },
        people: [],
        testimonials: [{ quote: i.testimonial, author: 'A patient' }],
        claims: [i.notes],
        answers: [],
        assets: [],
        references: [],
        flags: [],
      },
      fx.input,
    );
    if (!parsed.ok) throw new Error(parsed.error);
    const { system, user } = buildRoundPrompt({
      projectName: fx.input.projectName,
      round: {
        number: 1,
        title: 'Home',
        scope: ['Home page'],
        skills: [],
        depends_on: [],
        hard: false,
        token_budget: 100_000,
      },
      designBrief: {
        palette: 'calm blues',
        fonts: 'Inter',
        layout: 'single column',
        references: '',
      },
      client: builderView(parsed.value),
      ownerNotes: [],
      skills: [],
    });
    for (const h of fx.hostile)
      expect(`${system}\n${user}`.toLowerCase()).not.toContain(h.toLowerCase());
    expect(user).toContain('Brightside Family Dental');
    expect(user).not.toContain('flags');
  });
});
