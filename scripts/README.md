# Scripts

Owner-run and maintenance scripts. Nothing here runs automatically except where a task says so.

| Script | Task | Purpose |
| --- | --- | --- |
| provisioning | P3-T09 | Creates a client repo from the master starter, installs the GitHub App, links the Vercel project, records the IDs |
| backup | P1-T10 | Encrypted database export, scheduled and before project close; deletes exports older than 180 days |
| doctor (`pnpm run doctor`) | P2-T17 | Reports whether this machine is set up: Node, git hooks, env files, local Supabase reachable, email provider on, public sign-ups off, all tables present, owner login exists. Changes nothing, prints no key. Type `pnpm run doctor`: plain `pnpm doctor` is pnpm's own built-in command, which silently checks something else |
| setup-env (`bash scripts/setup-env.sh`) | P2-T17 | Writes `apps/web/.env.local` and `apps/worker/.env` from the running local Supabase, creates the owner login, removes the password afterwards. Prints no key |
| load-template (`pnpm --filter @wpe/worker load-template [path]`) | P2-T01 | Validates an intake template JSON (default `templates/intake/generic.v1.json`) and stores it as an approved version in `intake_templates`. Same content again does nothing; different content under the same version is refused |
| runner (`pnpm --filter @wpe/worker start`) | P2-T04 | Starts the stage runner on your machine: looks for queued runs every 15 to 30 seconds, keeps their heartbeat, stops a cancelled run and reports the result. Ctrl+C stops it after the current run |
| enqueue-stub (`pnpm --filter @wpe/worker enqueue-stub [projectId]`) | P2-T04 | Queues a stub run (a fake task of about a minute) so you can watch the runner claim, heartbeat, finish or be cancelled on the Runs page. With no project id it creates a throwaway project |
| bootstrap owner | P1-T05 | Inserts the owner row into `owners` with the service role |
| handover | P5-T10 | Pushes one clean commit into the empty repo the client creates and shares |

Scripts that need privileged credentials are run by the owner, never by an agent. See `docs/spec/15-operations.md`.

## Backups (P1-T10)

Needs `pg_dump` (same major version as the Supabase server or newer), `age` and `python3`. The script splits `SUPABASE_DB_URL` into the `PG*` environment variables, so the password never appears on a command line.

```
cp scripts/.env.backup.example scripts/.env.backup     # fill in; the real file is gitignored
age-keygen -o ~/wpe-age-key.txt                        # outside the repo; copy it into your password manager, then delete it
bash scripts/backup.sh                                 # on demand
bash scripts/backup.sh final-dental                    # before closing a project
```

Schedule it in WSL with `crontab -e` (weekly, Sunday 02:00; runs only while the laptop and WSL are awake, so a missed run is simply the next one):

```
0 2 * * 0 bash /home/<you>/webdev-pipeline-engine/scripts/backup.sh >> /home/<you>/wpe-backups/backup.log 2>&1
```

Exports older than 180 days are deleted from both folders on every run (D-222). Check the script with `WPE_TEST_DB_URL=... bash scripts/backup.test.sh` against a scratch database.
