// Creates the owner's login and the matching row in `owners` (P1-T05). Safe to run twice.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@wpe/shared';

export type BootstrapDeps = {
  findUserId(email: string): Promise<string | null>;
  createUser(email: string, password: string): Promise<string>;
  insertOwner(userId: string): Promise<void>;
};

export const MIN_PASSWORD_LENGTH = 12;

export async function bootstrapOwner(
  deps: BootstrapDeps,
  email: string,
  password: string,
): Promise<{ userId: string; createdUser: boolean }> {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    throw new Error('OWNER_EMAIL is not a valid email address');
  const existing = await deps.findUserId(email);
  if (existing) {
    await deps.insertOwner(existing);
    return { userId: existing, createdUser: false };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`OWNER_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  const userId = await deps.createUser(email, password);
  await deps.insertOwner(userId);
  return { userId, createdUser: true };
}

/** Real dependencies on top of a service-role Supabase client. */
export function supabaseDeps(admin: SupabaseClient<Database>): BootstrapDeps {
  return {
    async findUserId(email) {
      for (let page = 1; ; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (hit) return hit.id;
        if (data.users.length < 200) return null;
      }
    },
    async createUser(email, password) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) throw error ?? new Error('createUser returned no user');
      return data.user.id;
    },
    async insertOwner(userId) {
      const { error } = await admin.from('owners').upsert({ id: userId }, { onConflict: 'id' });
      if (error) throw error;
    },
  };
}
