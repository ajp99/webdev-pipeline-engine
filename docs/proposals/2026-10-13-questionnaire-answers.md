# Proposal: decisions from the post-Phase 1 refinement questionnaire

- **Status:** accepted (2026-10-13)
- **Date:** 2026-10-13
- **Raised by:** owner (answers to the 52-question refinement questionnaire), written up by the agent
- **Task or spec reference:** all of Phases 2 to 5; `docs/spec/stages.yaml`, `03-pipeline-and-gates.md`, `09-deployment-and-handover.md`, `10-data-model.md`, `12-security.md`, `15-operations.md`, `DECISIONS.md`. Builds on `2026-10-08-phase-1-spec-alignment.md` and `2026-10-09-pr6-review-changes.md`.

## Problem

The questionnaire collected every gap and piece of debt found in Phase 1. The owner answered it in chat. This proposal records the answers that change the spec, the decisions or the plan. Spec files and `DECISIONS.md` are the owner's to edit, so the draft rows are at the end. The plan files (`docs/plan/`) and `AGENTS.md` were edited in the same PR, as the owner asked.

Question numbers (A1 to G4) refer to the questionnaire; the questions and the recorded answers are in `2026-10-13-questionnaire-appendix.md`. All P0 and P1 rows were answered, which meets the owner's condition for closing Phase 1 (G1: "P0 and P1 both").

## Proposed change

### Spec alignment (A1 to A3)

1. **Keep all of migration 0002** (A1). It is not applied anywhere yet.
2. **Apply the six differences from the 2026-10-08 proposal as spec edits** (A2, option A for all six): gate artifact names, round summaries, who counts as an approver, "Ready to advance", public sign-ups off, and the two unbuilt items.
3. **Rename `outputs` in `stages.yaml` to match the gating artifact names** (A3), instead of adding a `gate_artifact` field. `stages.yaml` is a spec file, so the owner edits it; no test reads `outputs`, so none needs to change.

### Gates and approvals (B1 to B9)

4. **Cancel a project (B1).** Allowed from any stage before handover, with a typed confirmation and a reason, and with no export required (the weekly backup is the safety net; owner's decision at the PR review, 2026-10-13). A database function and a console button (P2-T20).
5. **`retention_until` is set by the function that closes a project** (B2): both the normal close and a cancel, so no closed project lacks a date. P5-T11 only reads it.
6. **Advance stays an explicit click** (B3), with an email to the owner when a client approval makes a project ready. Already decided (D-234).
7. **Reject only marks; Feedback is capped at 3** on the soft gates without a cap (B4, B5). Already decided (D-234).
8. **Edits after approval (B6).** While a stage is open, a new version of its artifact needs a fresh approval. Once the project has advanced, a new version of that stage's artifact is blocked; the change goes through a change request.
9. **Paused projects (B7).** Resume before approving. A pause means nothing moves. No change.
10. **Named client signer (B8).** Each project has one named client signer; only that person's approval counts at client gates. Other client logins can read. This needs a column or table and a change to `advance_stage()` and the client approval policy, a migration the owner approves (in P2-T12).
11. **Closing is blocked by undeployed change requests (B9).** The owner cannot mark handover complete while an accepted change request is undeployed; deploy, defer or decline it first. The transfer script (D-230) also refuses to start, and so does not set the freeze, while one is undeployed.

### Auth and security (C1 to C9)

12. **Auth settings (C2).** Public sign-ups off; client minimum password length 12 (matching the owner script). Email confirmation was not discussed and stays at the Supabase default.
13. **Invite lifetime (C3).** The spec is changed to match whatever cap Supabase applies to its own links (read it in the dashboard during the live checks); the console's Resend invite button covers expiry. No own invite-token table.
14. **Accepted risks, kept as they are:** no owner multi-factor (C1), no "laptop lost" runbook (C4), no restore drill (C5, D-069), one copy of the age private key (C6), no rule about business details in public docs (C9).
15. **`backup.sh` password handling (C7).** Fixed in this PR: the database URL is split into `PG*` environment variables so the password is not on the `pg_dump` command line.
16. **GitHub secret scanning, push protection and revoking the old token (C8)** are still unconfirmed. Owner check before merging PR #6.

### Quality, process and tooling (D1 to E8)

17. **Live checks (D1).** Follow the 12 steps in `docs/plan/phase-1-owner-steps.md`. The database checks run once on a local Supabase under WSL2 Docker (A5).
18. **Gate rules live in the database only (D2, D3).** A migration early in Phase 2 adds (a) a function that returns a project's remaining gates, which the console calls instead of re-implementing the rules in TypeScript, and (b) `accept_gate`, one transaction that records the approval, marks the artifact approved and advances when nothing is left. Each migration gets its own PR and the owner's approval (P2-T18).
19. **CI at the start of Phase 2 (D4).** One GitHub Actions workflow: lint, typecheck, unit tests and the database checks on a Postgres service (P2-T17). Partly supersedes D-046 and D-225.
20. **Applied migrations are frozen (D5).** Once 0001 and 0002 are applied to the real project they are never edited; every later change is a new numbered migration, forward-only, with no down scripts.
21. **TypeScript pin (D6).** Revisit only when something breaks.
22. **Setup scripts (E1).** A `pnpm doctor` preflight (env present, migrations applied, sign-ups off) and one script per owner step where the tools allow (P2-T17).
23. **PRs per cluster (E3).** From Phase 2, one PR per cluster of 2 to 4 related tasks. Migrations always get their own PR.
24. **Proposals (E5).** At the start and the end of each phase the agent asks the owner whether to apply the open proposals, with a ready-to-apply patch.
25. **Independent review (E6).** A fresh reviewer who has not seen the build checks the work before every phase gate and before every migration PR.
26. **PROGRESS entries are short (E4):** what changed, evidence, open items. Detail goes in the PR description.
27. **Mutation check (E7).** For every database or access rule, prove the test by breaking the rule and watching a check fail. Written into `AGENTS.md`.
28. **The Claude Doc spec copy is retired (E8)** and was deleted on 2026-10-13. The repo is the only source. Supersedes D-226.

### Operations and scope (F1 to G4)

29. **Free-tier pause (F1).** Check Supabase's current inactivity rule during the live checks; add a weekly keep-alive request if it still applies.
30. **Retention job (F3).** Runs at every worker start, so a missed date is caught up, and the console shows an overdue badge and a manual "Run retention now" button.
31. **Kept as accepted:** no spend cap (F4), Gmail stays regardless of the deliverability test (F6), the Vercel plan check is ignored for now (F8), no safeguards for reference-site URLs in P3-T12 (F9).
32. **Evals before the Planner (F5).** The three fictional client fixtures and expected-output checks are written before P3-T03.
33. **Phase 2 splits in two (F7).** 2a: templates, intake form, runner, intake agent, owner intake review, scanning, design section, client invites and the email sender (moved here at the PR review because the test client needs a login and the follow-up email), and the new gate and console tasks. Gate (drafted by the agent, owner to adjust): a test client's intake runs through the real stage runner and intake agent to an accepted intake. 2b: PRD, client review, change requests, dashboard basics (privacy page, mobile-first layout). Gate: a test client signs off a PRD (the existing gate).
34. **Pilot (F10).** After Phase 5, with a dry run of the handover script on a throwaway repo (moved from after Phase 4 to the start of Phase 5, D-250, because the script is built in Phase 5).
35. **Scope (G3, G4).** Nothing is cut and no extra problems were raised.

### Decisions from the PR review (2026-10-13)

36. **Stale heartbeat versus stopped.** A stale heartbeat (10 minutes) re-queues the run within the 2-attempt limit; only a live run with no progress becomes `stopped`. Rate-limit backoff counts as a sign of life. Recorded in the PR #6 review proposal (D-232).
37. **Hosting.** The owner's Vercel account moves to a paid plan from the first real client (the pilot on the owner's own site may stay on the free plan); the Vercel terms are as far as the spec author knows non-commercial-only on the free plan, still unverified. D-155 (the client recreates the Vercel project at handover) stays. The dashboard stays on its `vercel.app` address, also after the pilot (D-197), with invites from the same Gmail (D-224).
38. **Supabase MCP.** `.mcp.json` keeps full access, but agents use it for reads and docs only. Any write through it (data, schema, functions, storage, branches, migrations) needs the owner's approval first, and schema changes still follow `AGENTS.md` rule 4. Added to `AGENTS.md`.
39. **One-time exception.** PR #6 contains migration 0002 with code and docs; the rule that every migration gets its own PR starts with the next migration.

### Decisions while applying the proposals (2026-10-13)

40. **After close the dashboard shows the whole handover guide**, including the handover document, which may contain credentials. The retention job erases the guide's contents and PDF at the retention date; manual sharing is no longer required; the README stays in the repo. Spec 12 now allows this one exception to "no client secrets in the database", recorded as an accepted risk (D-247).
41. **Agents may edit the spec only after the owner approves a proposal**, in a PR with spec changes only (D-248; PR #7).
42. **An accepted change request may create a new version of a past stage's artifact** (the PRD bump of spec 05), as the exception to "blocked once the project has advanced" (item 8).

## Handling of G2 ("all in one PR") against E3 and `AGENTS.md`

G2 asked for everything, including migrations, in one PR. E3 said migrations get their own PR, and `AGENTS.md` rule 4 requires the owner's approval for each schema change. This PR therefore holds the proposal, the plan edits, the `AGENTS.md` rules and the `backup.sh` fix, and turns the migrations into Phase 2 tasks (P2-T18, P2-T20, P2-T12, and P2-T04 for the `stopped` status) that each get their own PR and approval. **Owner: confirm, or say if you want the migration files drafted here after all.**

## Owner actions that follow

- Answer C8 (secret scanning, push protection, old token revoked) and do steps 1 to 12 of `docs/plan/phase-1-owner-steps.md`, including one local-Supabase database run on WSL2 Docker (A5).
- Merge PR #6 with a merge commit (A6).
- Apply the spec edits listed above and add the draft rows below to `DECISIONS.md`; then mark Phase 1 done in `docs/plan/README.md`.

## Options considered

- Option A: accept everything above, then apply the spec edits.
- Option B: accept the plan and process changes now and take the spec edits at the Phase 2 start (the spec-sync step in item 24).
- Not chosen: owner multi-factor now (C1), an invite-token table (C3), a hard spend cap (F4), keeping the Claude Doc (E8), one PR for everything including migrations (G2 as asked).

## Impact

- **Spec files:** `stages.yaml`, `03-pipeline-and-gates.md`, `09-deployment-and-handover.md`, `10-data-model.md`, `12-security.md`, `15-operations.md`, and the banners at the top of the spec files that name the Claude Doc (`docs/spec/README.md`, `00-overview.md`, `07-build-rounds.md`, `10-data-model.md`, `11-owner-console-and-client-dashboard.md`, `13-cost.md`) and the `DECISIONS.md` header; the root `README.md` line was updated in this PR.
- **Plan:** `docs/plan/README.md` (Phase 2 becomes 2a and 2b, CI no longer deferred) and phase files 2 to 5.
- **Data model (each its own approved migration):** remaining-gates function and `accept_gate` (P2-T18), cancel and close functions with `retention_until` (P2-T20), named signer (P2-T12), `stopped` status (P2-T04), optional `retry_of`.
- **Decisions affected:** D-027, D-035, D-046, D-069, D-083, D-090, D-154, D-167, D-173, D-225, D-226 (statuses updated in `DECISIONS.md`).

## Draft DECISIONS.md rows

| ID | Area | Decision | Reason | Status |
| --- | --- | --- | --- | --- |
| D-235 | Spec | Migration 0002 stays whole. The six differences in `2026-10-08-phase-1-spec-alignment.md` are applied to the spec. `stages.yaml` `outputs` are renamed to the gating artifact names instead of adding a `gate_artifact` field | Owner's answers A1 to A3 | Active |
| D-236 | Docs | The Claude Doc spec copy is retired and deleted; the repo is the only source | Owner's choice (E8); removes a copy that could go stale. Supersedes D-226 | Active |
| D-237 | Cancel and close | The owner can cancel a project from any stage before handover, with a typed confirmation and a reason (no export required). The function that closes or cancels a project sets `retention_until`. Closing is blocked while an accepted change request is undeployed | Owner's answers B1, B2, B9 | Active |
| D-238 | Gates | Edits after approval: while the stage is open a new version needs a fresh approval; after advance, new versions of that artifact are blocked (use a change request; an accepted one creates the new version). A paused project must be resumed before approving. Each project has one named client signer | Owner's answers B6, B7, B8 | Active |
| D-239 | Gates | Gate rules live in the database: a remaining-gates function feeds the console, and `accept_gate` records the approval, marks the artifact and advances in one transaction. Added early in Phase 2, each migration in its own PR with the owner's approval | Owner's answers D2, D3, E3 | Active |
| D-240 | Process | CI (one GitHub Actions workflow) starts with Phase 2; applied migrations are frozen and forward-only; every database or access rule is proved by a mutation check; an independent review precedes every phase gate and migration PR; PRs are per cluster of 2 to 4 tasks; PROGRESS entries are short; the agent asks about applying proposals at the start and end of each phase | Owner's answers D4, D5, E3 to E7 | Active; partly supersedes D-046 and D-225 |
| D-241 | Setup | A `pnpm doctor` preflight and one script per owner step where the tools allow; the database checks run once on a local Supabase under WSL2 Docker | Owner's answers A5, D1, E1 | Active |
| D-242 | Security | Public sign-ups off; client minimum password 12; invite link lifetime follows Supabase's cap, with a Resend button. Kept as accepted risks: no owner MFA, no laptop-lost runbook, no restore drill, one age key copy, no rule on business details in public docs | Owner's answers C1 to C6, C9 | Active |
| D-243 | Operations | The retention job runs at every worker start, with an overdue badge and a manual "Run retention now" button. The free-tier pause rule is checked at the live checks, with a weekly keep-alive if it applies. No spend cap; Gmail stays; the Vercel plan check and reference-URL safeguards are not pursued now | Owner's answers F1, F3, F4, F6, F8, F9 | Active |
| D-244 | Plan | Phase 2 is split into 2a (intake through the real runner and intake agent) and 2b (PRD, client review, email, invites, change requests), each with its own gate (invites and the email sender are in 2a). Eval fixtures are written before the Planner. The pilot is after Phase 5, with a handover dry run after Phase 4 | Owner's answers F5, F7, F10 | Active |
| D-245 | Hosting | The owner's Vercel account moves to a paid plan from the first real client; the pilot on the owner's own site may stay on the free plan. D-155 stays. The dashboard stays on its `vercel.app` address, also after the pilot | Owner's choice at the PR review; the free plan's terms are unverified. Refines D-026 and D-191 | Active |
| D-246 | Tooling | The Supabase MCP server in `.mcp.json` is for reads and docs; any write through it needs the owner's approval first | Owner's choice at the PR review; it has full access to the project | Active |

## Owner decision

Accepted 2026-10-13. The spec edits are in PR #8 and the decisions are D-235 to D-248. Migrations stay Phase 2 tasks, each in its own PR with the owner's approval (the owner merged PR #6 with this handling).

### Decisions from the review of the applied proposals (2026-10-13)

43. **Resume (D-250).** Resume starts a new run on the same branch from the last commit; uncommitted work is lost and D-203 stays.
44. **Console commands (D-249).** A commands table written by the console and polled by the worker; the assistant's default when the owner was unsure.
45. **Handover guide visibility (D-251).** Client-visible only after the owner's hard-gate approval; enforced in the database.
