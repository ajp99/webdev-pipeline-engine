# Scripts

Owner-run and maintenance scripts. Nothing here runs automatically except where a task says so.

| Script | Task | Purpose |
| --- | --- | --- |
| provisioning | P3-T09 | Creates a client repo from the master starter, installs the GitHub App, links the Vercel project, records the IDs |
| backup | P1-T10 | Encrypted database export, scheduled and before project close; deletes exports older than 180 days |
| bootstrap owner | P1-T05 | Inserts the owner row into `owners` with the service role |
| handover | P5-T10 | Pushes one clean commit into the empty repo the client creates and shares |

Scripts that need privileged credentials are run by the owner, never by an agent. See `docs/spec/15-operations.md`.

## Backups (P1-T10)

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
