# Proposal: decisions from the senior review panel and questionnaire

- **Status:** accepted (2026-10-15)
- **Date:** 2026-10-15
- **Raised by:** agent, from the senior review panel report and the owner's answers in the follow-up questionnaire (about 14 rounds in chat)
- **Task or spec reference:** `docs/spec/00`, `02`, `03`, `06`, `07`, `08`, `10`, `11`, `12`, `14`, `15`; plan phases 1 to 5; `AGENTS.md`

## Problem

A review of the project and the repo (security, agent design, platform and developer experience, reliability, and debt) found gaps and open questions. The owner answered each one in a questionnaire. The answers change the spec, the plan, the working rules and the database design, and some of them reverse earlier decisions (D-058, D-130, D-240). Nothing in the repo records them yet.

## Proposed change

Record the answers as decisions D-263 to D-296 (`DECISIONS.md`), apply the spec edits listed below in a spec-only PR, sync the plan, and add a go-live readiness checklist for everything deferred by the dev-only decision. The decisions, with the spec files each one changes:

| ID | Area | Decision | Spec files |
| --- | --- | --- | --- |
| D-263 | Scope | Development is dev-only until go-live: development, tests and the pilot use a local Supabase (Supabase CLI, `supabase start`) with no hosted project and no real clients. Client-facing hosting and notification work stays in the plan and is exercised with a second owner-controlled test account. Everything deferred is tracked in `docs/plan/go-live-readiness.md`. Defers the hosted parts of D-196 to D-204, D-243 and D-245 | 00, 02, 15 |
| D-264 | Security | The orchestrator alone holds the Supabase service key. Agent runs hold no Supabase credentials and write only through narrow routines the orchestrator mediates (for example `submit_artifact`). `advance_stage()` and the future `accept_gate` are callable only from an owner session, never by the service role or an agent. Refines D-255 and D-258 | 02, 03, 12 |
| D-265 | Approvals | Each approval stores the SHA-256 of the artifact's content, set by the database when the approval is written; the client's sign-off shows it. Artifact content is already immutable (D-254), so the hash proves what was approved | 10, 12 |
| D-266 | Security | Each agent run executes in its own container: no host mounts, non-root, scrubbed environment, egress limited to the npm registry, GitHub and the Anthropic API, and a per-run GitHub token. It is designed into the Phase 2 runner, not added in Phase 4. Replaces directory-only isolation | 02, 06, 12, 14, 15 |
| D-267 | Security | A tool-less reader step turns client text, uploads and reference screenshots into schema-validated fields, so the shell-capable Builder never sees raw client content. The owner reviews the diff of `.pipeline/NOTES.md` at each round gate. Prompt-injection cases are added to the eval fixtures | 06, 07, 12 |
| D-268 | Approvals | A hard-gate Accept (deploy prep, handover) requires typing the project name in the console. No multi-factor is planned, now or at go-live (accepted risk). Refines D-031 and D-206 | 03, 11, 14 |
| D-269 | Approvals | An approval keeps a snapshot of the giver's email, written by the database when the approval is inserted. If the login is deleted, `approved_by` is cleared (D-254) and the snapshot stays, so the log stays readable and users and projects stay deletable | 10 |
| D-270 | Data model | A client can change only the answer of an intake response (not its round, question or origin). The other protected project columns and the stage on insert are already guarded by D-253 and D-255 | 10, 12 |
| D-271 | Data model | Security-definer helpers used by policies and gate functions live in a `private` schema that the API does not expose; every security-definer function sets an empty `search_path` and uses qualified names; execute is granted only to the roles that need it | 10, 12 |
| D-272 | Gates | `advance_stage()` honours `gate_config.gatekeeper`. Global gate rows cannot be deleted and only their deadline can change; a project row can add a gate or change a deadline but cannot change the gatekeeper of a global gate. The owner keeps edit access within those limits. Refines D-239 | 03, 10 |
| D-273 | Handover | Handover credentials stay in the database as in D-247 for the dev-only period. This is an accepted risk and an item on the go-live checklist | 09, 14 |
| D-274 | Tooling | `.mcp.json` points at the local Supabase stack and is read-only, not at a hosted project. Agents still use it for reads and documentation only. Refines D-246 | 12, 15 |
| D-275 | Agents | Single-shot roles (intake review, Requirements, Planner, Reporter) are plain API calls with JSON-schema structured output; the Agent SDK is for the Builder, the Prototype agent and QC fixes. The PRD is stored as schema-validated JSON, one markdown string per section, and rendered for the client and the editor | 05, 06 |
| D-276 | Runner | Every run has a hard wall-clock cap (about 2 times the watchdog limit for its kind) and a turn limit. Spend gets alerts only: no token-based kill and no hard spend cap (accepted risk). Refines D-232 | 14, 15 |
| D-277 | Runner | Retries and Resume must not repeat side effects: find-or-create the pull request by branch, idempotency keys for external calls, a step journal in `run_logs`, and a commit before each side effect | 07, 15 |
| D-278 | Runner | Every `stage_runs` status transition goes through the claim and transition function (P2-T04), and a partial unique index allows only one running or waiting run per project. Refines D-050 and D-082 | 10, 15 |
| D-279 | Approvals | Accept happens only in the console. A merge of a round's pull request in GitHub does not count as Accept, and the GitHub webhook and its credential are removed from the design. Supersedes D-058 and task P4-T11 | 00, 02, 03, 07, 11, 12 |
| D-280 | Runner | Resume of a parked or stopped run is built from the step journal and the last commit (D-250). Any Agent SDK session resume is checked in the walking skeleton and used only as an optimisation. Refines D-257 | 15 |
| D-281 | Operations | `stage_runs` and `run_logs` carry a `trace_id`; logs are structured lines with project, stage and run IDs and show in the run detail view | 11, 15 |
| D-282 | Skills | Skills are versioned plain files loaded only when the Planner selected them. The promotion lifecycle (match, generalize, candidate) is deferred until at least 2 projects have good marks. Refines D-105 to D-107 | 06 |
| D-283 | Agents | Model IDs are pinned and every run records `model` and `prompt_hash`. Evals stay as specced (D-065 to D-068); there is no automated check on prompt or model changes before the Planner exists (accepted risk) | 06, 14, 15 |
| D-284 | QC | QC adds a claim scan (numbers, award, certified, licensed, guarantee, since, %) over agent-written copy and an LLM verifier that checks each hit against the PRD and intake. `<Claim>` markers stay. Unmarked claims are caught only probabilistically (accepted risk) | 07, 08, 14 |
| D-285 | QC | Lighthouse also runs on the pages a change-request mini-round touches. Accessibility tooling beyond Lighthouse is not added. Refines D-175 | 08, 14 |
| D-286 | Builder | Dependency install scripts run for all packages, only inside the run's container. Builds use a frozen lockfile and each round summary shows the lockfile diff (packages added or changed, versions, which have install scripts). A package that is not in the plan and not on a curated allowlist is flagged and needs the owner's approval. Dependabot or Renovate opens weekly update pull requests on the master starter. Refines D-130 | 06, 07, 12, 14 |
| D-287 | Process | CI starts in Phase 1 (task P1-T12): lint, typecheck, unit tests and the database checks on the local Supabase stack, plus CODEOWNERS review for `supabase/migrations/**`. Supersedes the Phase 2 start in D-240 and the deferral in D-046 and D-225 | 12, 15 |
| D-288 | Process | A scripted mutation-check runs on every PR that touches `supabase/**` and before each phase gate. Worker tests are fakes and unit tests only; lifecycle tests are not added up front | 15 |
| D-289 | Process | Until real client data exists, migrations are not frozen: they may be edited in place within a phase and are squashed into a fresh baseline at each phase gate, each such change still in its own PR with an independent review. Once real data exists an applied migration is frozen as in D-240. Refines D-240 and D-256 | 10, 15 |
| D-290 | Plan | A walking skeleton is built by the end of Phase 2a: one fictional client through template, intake, a stub PRD and a single-page build with a preview, using the real worker, container and database (task P2-T23). The pilot moves earlier than the end of Phase 5; its exact point is decided when the skeleton is reviewed. Refines D-064, D-172 and D-244 | 15 |
| D-291 | Process | Status and stage tables are generated from `PROGRESS.md` and `stages.yaml` and `gates.yaml`, and a CI docs-lint (placeholders, decision-ID continuity, broken links) guards the docs. The lint ships first (task P1-T14); generation follows once the source of truth for phase status is chosen | 15 |
| D-292 | Process | Secret scanning and push protection (C8) are enabled and the old personal access token is revoked now, before further work | 12 |
| D-293 | Console | The console shows time to decision per gate and Feedback loops per artifact, computed from existing timestamps, from Phase 2 (task P2-T24) | 11 |
| D-294 | Operations | `scripts/backup.sh` stays with age encryption, pointed at the local database, and one restore of an export into a scratch database is proved in Phase 1 (task P1-T15) | 12, 15 |
| D-295 | Security | Only the orchestrator connects to the database. Agent runs get no database credentials and no Supabase MCP write access. Refines D-264's routines | 02, 12 |
| D-296 | Process | `docs/plan/go-live-readiness.md` lists every deferred item (hosting, client email, MFA, credentials, spend control, backup custody, migration freeze, privacy regime, plan terms, evals) and is a Phase 5 gate item | plan |

New accepted risks for `docs/spec/14-risks-and-out-of-scope.md`: no multi-factor sign-in, now or at go-live; handover credentials stored in the database; no token-based kill and no hard spend cap; no automated check when a prompt or model changes before the Planner exists; unmarked factual claims are caught only probabilistically; no accessibility or visual checks beyond Lighthouse; install scripts for all packages are contained only by the run's container.

Superseded or refined earlier decisions: D-058 is superseded by D-279 (and task P4-T11 is dropped); D-046, D-225 and D-240 are refined by D-287 and D-289; D-130 by D-286; D-246 by D-274.

## Options considered

Each question had several options with a recommended one; the full text is in the chat. Where the owner chose something other than the recommended option, the decision row says so (D-268, D-273, D-276, D-283, D-289). A hosted-or-local database question led to the dev-only decision (D-263); the alternatives to Supabase were discussed and not chosen.

## Impact

- **Spec:** the files in the table, in one spec-only PR with exactly these edits. Chiefly: the GitHub webhook and merge-as-Accept are removed (02, 03, 07, 11, 12); trust zones and the per-run container are added (02, 06, 12, 14, 15); typed project-name confirmation, gatekeeper enforcement and owner-session-only gate functions are added (03, 10, 11); data model additions are described in 10; CI and the mutation script are described in 15.
- **Plan:** P1-T02 is rewritten for a local Supabase; new tasks P1-T12 to P1-T17, P2-T23, P2-T24 and P4-T13; P4-T11 is dropped; appends to P1-T08, P1-T10, P1-T11, P2-T04, P2-T05, P2-T07, P2-T17, P2-T18, P2-T22, P3-T01 to P3-T03, P3-T10, P4-T02, P4-T05, P4-T06, P4-T09, P5-T01, P5-T07, P5-T09 and P5-T12.
- **Database (own PR, independent review):** a `private` schema and empty `search_path` for security-definer helpers; `approvals.content_sha256` and `approved_by_email`; `advance_stage()` honours the effective gatekeeper and global `gate_config` rows are protected; `stage_runs.trace_id`, `model`, `prompt_hash` and a partial unique index for one active run per project; an `intake_responses` guard; all proved by a mutation script.
- **Process:** `AGENTS.md` (migration freeze wording, MCP, trust zones, dev-only note), CI and CODEOWNERS, docs-lint.

## Owner decision

Approved by the owner in chat on 2026-10-15: the questionnaire answers recorded in the decision rows, "Yes" to drafting this proposal, and "Do the commits to repo and do checks, mutations checks, and all pending spec and proposal updates cleanly and throughly."

Points where the agent made a call the owner should confirm in review:

1. **Approver identity (D-269).** The owner answered "plain uuid plus email snapshot". D-254 (PR #12) already makes `approved_by` a nullable foreign key cleared on login deletion. The foreign key is kept and only the snapshot is added.
2. **Migration freeze (D-289).** The owner chose "rebaseline each phase". The row words this as: no freeze until real client data exists, edit in place within a phase, squash at each phase gate.
3. **Still open, deliberately.** The client email path under dev-only; stall alerts and web-tier email ("might change after dev only decision"); the source of truth for generated status tables (the docs-lint ships first); the exact pilot point (decided when the walking skeleton is reviewed).
4. **Not verified when written.** The Supabase CLI MCP read-only flag, pnpm install-script settings and Agent SDK session resume are checked when the tasks that use them are done; the Docker-based `supabase start` CI path cannot be run in the agent's sandbox.
