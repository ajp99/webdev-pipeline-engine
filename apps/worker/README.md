# apps/worker

Stage runner plus Agent SDK workers. Runs on the owner's own machine and is woken by Supabase Realtime when the owner approves a stage.

- Holds the Claude API key and the Supabase service role key. Keep them out of `apps/web`.
- Each stage runs in a per-project working directory with scoped GitHub and Vercel tokens for that project only.
- Status: empty scaffold. Built from phase 2 (stage runner interface, task P2-T06) onward.

See `docs/spec/02-architecture.md` and `docs/spec/12-security.md`.
