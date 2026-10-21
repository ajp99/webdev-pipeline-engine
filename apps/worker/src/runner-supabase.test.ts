import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { Database } from '@wpe/shared';
import { supabaseRunnerDeps } from './runner-supabase';

type Call = { fn: string; args: Record<string, unknown> };
function fakeAdmin(reply: { data: unknown; error: { message: string } | null }) {
  const calls: Call[] = [];
  const admin = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return reply;
    },
  } as unknown as SupabaseClient<Database>;
  return { admin, calls };
}

describe('supabaseRunnerDeps', () => {
  it('claim returns the first row, or null when the queue is empty', async () => {
    const one = fakeAdmin({ data: [{ id: 'r1' }], error: null });
    expect(await supabaseRunnerDeps(one.admin).claim('w1')).toEqual({ id: 'r1' });
    expect(one.calls).toEqual([{ fn: 'claim_run', args: { p_worker: 'w1' } }]);
    const none = fakeAdmin({ data: [], error: null });
    expect(await supabaseRunnerDeps(none.admin).claim('w1')).toBeNull();
  });

  it('heartbeat passes the run and worker and returns the status', async () => {
    const { admin, calls } = fakeAdmin({ data: 'cancel_requested', error: null });
    expect(await supabaseRunnerDeps(admin).heartbeat('r1', 'w1')).toBe('cancel_requested');
    expect(calls).toEqual([{ fn: 'heartbeat_run', args: { p_run: 'r1', p_worker: 'w1' } }]);
  });

  it('finish passes the status and the tokens', async () => {
    const { admin, calls } = fakeAdmin({ data: 'succeeded', error: null });
    expect(await supabaseRunnerDeps(admin).finish('r1', 'w1', 'succeeded', 7)).toBe('succeeded');
    expect(calls[0]).toEqual({
      fn: 'finish_run',
      args: { p_run: 'r1', p_worker: 'w1', p_status: 'succeeded', p_tokens: 7 },
    });
  });

  it('turns a database error into an error naming the function', async () => {
    const { admin } = fakeAdmin({ data: null, error: { message: 'not allowed' } });
    const deps = supabaseRunnerDeps(admin);
    await expect(deps.claim('w1')).rejects.toThrow('claim_run: not allowed');
    await expect(deps.heartbeat('r1', 'w1')).rejects.toThrow('heartbeat_run: not allowed');
    await expect(deps.finish('r1', 'w1', 'failed', 0)).rejects.toThrow('finish_run: not allowed');
  });
});
