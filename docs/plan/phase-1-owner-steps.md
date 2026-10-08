# Phase 1: steps only the owner can do

The agent built and tested everything it could without a Supabase project, Docker or your accounts. These steps finish tasks P1-T02, P1-T05, P1-T06, P1-T08, P1-T09, P1-T10 and P1-T11. Do them in this order, on your laptop in WSL2. Never paste keys into chat.

1. **Create the Supabase project (P1-T02).** Free plan, a region near you, a database password saved in your password manager. Note the project reference.
2. **Review the schema once more.** Read `supabase/migrations/0001_init.sql` and `0002_advance_stage.sql`. Say so in the PR if anything should change; changes go into a new migration, never an edited one.
3. **Apply the migrations.** `supabase login`, `supabase link --project-ref <ref>`, `supabase db push`. Check in the dashboard that there are 23 tables.
4. **Fill in the secrets.** `apps/web/.env.local`: the project URL and the anon key. `apps/worker/.env`: the URL, the service role key, `OWNER_EMAIL`, `OWNER_PASSWORD` (12 characters or more). Both files are gitignored.
5. **Regenerate the database types.** `SUPABASE_DB_URL=<connection string> scripts/gen-types.sh`. The result should be identical to the committed file.
6. **Create your owner login.** `pnpm --filter @wpe/worker bootstrap-owner`, then delete `OWNER_PASSWORD` from `.env`.
7. **Check sign-in (P1-T05).** `pnpm dev`, open the app, sign in as the owner. Then create a client login by hand in the Supabase dashboard (Authentication) plus a row in `clients`, sign in as that user and confirm `/owner` sends you to `/client`.
8. **Run the gate demonstration (P1-T09).** `pnpm --filter @wpe/worker seed-demo`, open Approval queue, press Accept on the demo project. The project should move from intake to requirements. Paste what you saw into `docs/plan/PROGRESS.md`.
9. **Run the database checks on a local Supabase (P1-T08).** Needs Docker: `supabase start`, `supabase db reset`, then the command in `supabase/tests/README.md`. Expect every check to pass, then `supabase db reset` again to clear the fixture rows.
10. **Set up backups (P1-T10).** Follow `scripts/README.md`: age key pair (private key into the password manager), `scripts/.env.backup`, the crontab line.
11. **GitHub settings (P1-T11).** Repository Settings, Code security: turn on secret scanning and push protection. Revoke the personal access token that was pasted into chat earlier.
12. **Accept the phase.** When the gate demonstration worked, set **Status** in `phase-1-foundation.md` to `done` and update `docs/plan/README.md`.
