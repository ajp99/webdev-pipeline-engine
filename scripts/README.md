# Scripts

Owner-run and maintenance scripts. Nothing here runs automatically except where a task says so.

| Script | Task | Purpose |
| --- | --- | --- |
| provisioning | P3-T09 | Creates a client repo from the master starter, installs the GitHub App, links the Vercel project, records the IDs |
| backup | P1-T10 | Encrypted database export, scheduled and before project close |
| bootstrap owner | P1-T05 | Inserts the owner row into `owners` with the service role |

Scripts that need privileged credentials are run by the owner, never by an agent. See `docs/spec/15-operations.md`.
