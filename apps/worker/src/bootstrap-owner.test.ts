import { describe, expect, it } from 'vitest';
import { bootstrapOwner, type BootstrapDeps } from './bootstrap-owner';

function fake(existingId: string | null = null, confirmed = true) {
  const calls: string[] = [];
  const deps: BootstrapDeps = {
    findUser: async () => (existingId ? { id: existingId, confirmed } : null),
    createUser: async (email) => (calls.push(`create ${email}`), 'new-id'),
    insertOwner: async (id) => void calls.push(`owner ${id}`),
  };
  return { deps, calls };
}

describe('bootstrapOwner', () => {
  it('creates the user and the owners row', async () => {
    const { deps, calls } = fake();
    const r = await bootstrapOwner(deps, 'me@example.com', 'a-long-enough-password');
    expect(r).toEqual({ userId: 'new-id', createdUser: true });
    expect(calls).toEqual(['create me@example.com', 'owner new-id']);
  });
  it('reuses an existing user and does not need a password', async () => {
    const { deps, calls } = fake('old-id');
    const r = await bootstrapOwner(deps, 'me@example.com', '');
    expect(r).toEqual({ userId: 'old-id', createdUser: false });
    expect(calls).toEqual(['owner old-id']);
  });
  it('refuses to make an unconfirmed existing login the owner', async () => {
    const { deps, calls } = fake('squatter', false);
    await expect(bootstrapOwner(deps, 'me@example.com', 'a-long-enough-password')).rejects.toThrow(
      /not confirmed/,
    );
    expect(calls).toEqual([]);
  });
  it('rejects a short password before creating anything', async () => {
    const { deps, calls } = fake();
    await expect(bootstrapOwner(deps, 'me@example.com', 'short')).rejects.toThrow(/at least 12/);
    expect(calls).toEqual([]);
  });
  it('rejects a malformed email', async () => {
    const { deps } = fake();
    await expect(bootstrapOwner(deps, 'not-an-email', 'a-long-enough-password')).rejects.toThrow(
      /valid email/,
    );
  });
});
