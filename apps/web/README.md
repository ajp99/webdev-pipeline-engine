# apps/web

Next.js app serving the owner console and the client dashboard (one app, split by role).

- Deployed to Vercel with `apps/web` as the root directory.
- Must never hold the Claude API key, the Supabase service role key, or any GitHub or Vercel tokens. Those belong to `apps/worker` only.
- Status: empty scaffold. Dependencies and the Next.js setup are added in phase 1, task P1-T01.

See `docs/spec/11-owner-console-and-client-dashboard.md`.
