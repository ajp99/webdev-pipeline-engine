# Go-live readiness checklist

Development is dev-only until go-live (D-263): a local Supabase, no hosted project, no real clients. Everything that decision and its companions defer is listed here. The owner ticks an item when it is decided and done. Reviewing this list is part of the Phase 5 gate (task P5-T12) and no real client is onboarded before every item is ticked or accepted as a risk in writing (D-296).

| Done | # | Item | State while dev-only | Needed before the first real client | Decisions |
| --- | --- | --- | --- | --- | --- |
| [ ] | G1 | Hosting | Local Supabase (CLI and Docker); no hosted project; the dashboard is not deployed. | Create the hosted Supabase project on the Pro plan; deploy the dashboard to Vercel (paid plan from the first real client, D-245); settle the free-plan pause rule or skip it by using Pro (D-243); repeat the sign-up-off and migration checks on the hosted project. | D-196 to D-204, D-243, D-245, D-263 |
| [ ] | G2 | Client email | No client emails. The path under dev-only is undecided; invites and notifications are exercised with a second owner-controlled account. | Choose and test the sending path (SMTP from the owner's Gmail with an app password, or another sender); Supabase custom SMTP for invites and resets; check daily limits and the dedupe key. | D-045, D-156, D-231, D-234, D-263 |
| [ ] | G3 | Sign-in strength | No multi-factor; owner and clients use passwords of 12 or more characters; hard gates need a typed project name. | Confirm the accepted risk again with real client data present, or add TOTP and step-up on hard gates. | D-268 |
| [ ] | G4 | Handover credentials | Stored in the database as in D-247. | Decide to keep, encrypt at rest, or store none; document where the client's credentials live and who can read them. | D-247, D-273 |
| [ ] | G5 | Spend control | Wall-clock cap, turn limit and spend alerts only; no token kill, no hard cap. | Set a spend limit on the Anthropic account; decide whether to add a token kill or hard cap; check the per-project cost against the estimate. | D-276 |
| [ ] | G6 | Backup custody | Age-encrypted dumps of the local database; one restore into a scratch database proved (P1-T15). | Name the cloud drive and who holds the private key; run a restore from the hosted database; confirm the 180-day deletion. | D-049, D-062, D-069, D-222, D-294 |
| [ ] | G7 | Migration freeze | Migrations may be edited in place and are squashed at each phase gate. | Squash a final baseline, then freeze: from the first real data every change is a new forward-only migration (D-240). | D-240, D-289 |
| [ ] | G8 | Privacy and retention | No real client data; the retention job is not scheduled. | Confirm which privacy rules apply to the clients, publish the privacy page, schedule the retention job and test deletion on the hosted project; explain the 180-day backup tail. | D-169, D-214, D-222 |
| [ ] | G9 | Provider terms and plans | Free tiers and developer accounts. | Read the terms of Supabase, Vercel, GitHub and Anthropic for client work; move to the plans they require. | D-245 |
| [ ] | G10 | Eval gate on prompt and model change | Model IDs pinned and `prompt_hash` logged; no automated check. | Decide whether a model or prompt change must pass the eval harness before use; the harness exists after P3-T10. | D-065 to D-068, D-283 |
| [ ] | G11 | Stall alerts and web-tier notifications | Deferred; the console shows run state. | Decide how the owner learns of a stalled run when away, and whether the web tier sends email. | owner's note in the questionnaire, D-263 |
| [ ] | G12 | Hosted MCP and database access | `.mcp.json` points at the local stack, read-only; only the orchestrator connects to the database. | Decide whether any hosted project may be connected to agents, and with what access. | D-246, D-274, D-295 |
| [ ] | G13 | Container and supply chain | Install scripts run for all packages inside the run's container; the container's egress is limited; weekly update pull requests on the master starter. | Test the container's isolation and egress limits with a hostile fixture; review the allowlist of packages; confirm update pull requests are being reviewed. | D-130, D-266, D-286 |
| [ ] | G14 | Repository controls | CI runs on every pull request; secret scanning and push protection are on; branch protection is the owner's call. | Make the CI checks required on `main`; confirm secret scanning and that the old token stays revoked. | D-046, D-287, D-292 |

## Open questions

- The email path for the dev-only period (G2, G11).
- Whether the source of truth for status tables is `PROGRESS.md` or a new file (task P1-T14 ships the lint first).
- The exact point of the pilot, decided when the walking skeleton is reviewed (task P2-T23).
