import { signIn } from './actions';

const MESSAGES: Record<string, string> = {
  invalid: 'Email or password is wrong.',
  no_role: 'This account is not set up for the pipeline. Ask the owner.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? MESSAGES[error] : undefined;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {message ? (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"
        >
          {message}
        </p>
      ) : null}
      <form action={signIn} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded border border-neutral-300 p-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded border border-neutral-300 p-2"
          />
        </label>
        <button type="submit" className="rounded bg-neutral-900 p-2 text-white">
          Sign in
        </button>
      </form>
    </main>
  );
}
