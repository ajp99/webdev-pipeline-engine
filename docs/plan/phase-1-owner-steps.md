# Phase 1: steps only the owner can do

Development is dev-only (D-263): everything runs on your laptop in WSL2 against a local Supabase, and there is no hosted project. These steps finish tasks P1-T02, P1-T08, P1-T09, P1-T11 and P1-T16 (P1-T05 and P1-T06 moved to Phase 2a; P1-T10 and P1-T15 moved to go-live). Do them in this order. Never paste keys into chat. Hosting, client email and the other deferred items are in [go-live-readiness.md](go-live-readiness.md).

At any point, `pnpm run doctor` checks your setup and tells you what is missing (it changes nothing and prints no key). Use `run`: plain `pnpm doctor` is pnpm's own built-in command and prints nothing.

0. **GitHub settings first (P1-T11).** Repository Settings, Code security: turn on secret scanning and push protection, and revoke the personal access token that was pasted into chat earlier.
1. **Start the local Supabase (P1-T02).** Needs Docker in WSL2: `supabase/config.toml` is already committed (public sign-ups off), so skip `supabase init` and run `supabase start`. Note the local API URL, anon key and service role key it prints.
2. **Review the schema once more.** Read `supabase/migrations/0001_init.sql` (the squashed baseline, D-308). Say so in the PR if anything should change; until real client data exists, migrations may be edited in place (D-289).
3. **Apply the migrations.** `supabase db reset`. Check that the tables listed in `docs/spec/10-data-model.md` exist (23 tables) and that public sign-ups are off (`enable_signup = false` under `[auth]` in the committed `supabase/config.toml`). Leave `[auth.email] enable_signup` set to `true`: the CLI uses it for the whole email provider, and `false` disables password sign-in too.
4. **Fill in the secrets.** `bash scripts/setup-env.sh` does this and step 6 for you, without printing any key. By hand: `apps/web/.env.local`: the local URL and the anon key. `apps/worker/.env`: the URL, the service role key, `OWNER_EMAIL`, `OWNER_PASSWORD` (12 characters or more). Both files are gitignored.
5. **Regenerate the database types.** `SUPABASE_DB_URL=<local connection string> scripts/gen-types.sh`. The result should be identical to the committed file.
6. **Create your owner login.** `pnpm --filter @wpe/worker bootstrap-owner`, then delete `OWNER_PASSWORD` from `.env`.
7. **Check sign-in.** `pnpm dev`, open the app and sign in as the owner (P1-T05 itself is a Phase 2a task). There is no client login until go-live (D-298).
8. **Run the gate demonstration (P1-T09).** `pnpm --filter @wpe/worker seed-demo`, open Approval queue, press Accept on the demo project. The project should move from intake to requirements. Paste what you saw into `docs/plan/PROGRESS.md`.
9. **Run the database checks on the local Supabase (P1-T08).** `supabase start`, `supabase db reset`, then the command in `supabase/tests/README.md`. Expect every check to pass, then `supabase db reset` again to clear the fixture rows.
10. **Backups are moved to go-live (P1-T10, P1-T15, G6, D-297); skip this step for now.** When they return, follow `scripts/README.md`: age key pair (private key into the password manager), `scripts/.env.backup`, the crontab line; then restore one export into a scratch database.
11. **Accept the phase.** When the gate demonstration worked, set **Status** in `phase-1-foundation.md` to `done` and update `docs/plan/README.md`.
