# apps/worker

Stage runner plus Agent SDK workers. Runs on the owner's own machine and polls the `stage_runs` queue in Supabase every 15 to 30 seconds for approved stages.

- Holds the Claude API key and the Supabase service role key. Keep them out of `apps/web`.
- Each stage runs in a per-project working directory with a short-lived GitHub App token limited to that project's repository. Workers hold no Vercel token.
- Status: empty scaffold. Built from phase 2 (stage runner with a durable queue, task P2-T04) onward.

See `docs/spec/02-architecture.md` and `docs/spec/12-security.md`.
