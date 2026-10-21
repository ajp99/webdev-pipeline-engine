'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === 'invalid_credentials') redirect('/login?error=invalid');
    // Anything else (provider off, server down) is not a wrong password: say so and log the cause.
    console.error('sign-in failed:', error.code ?? error.name, error.message);
    redirect('/login?error=unavailable');
  }
  redirect('/');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
