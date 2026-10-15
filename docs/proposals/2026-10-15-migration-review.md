# Proposal: migration review of 0001 and 0002 (before they are applied)

- **Status:** accepted (2026-10-15)
- **Date:** 2026-10-15
- **Raised by:** agent, from a review of both migrations on the scratch database
- **Task or spec reference:** `supabase/migrations/0001_init.sql`, `0002_advance_stage.sql`; `docs/spec/03-pipeline-and-gates.md`, `10-data-model.md`, `15-operations.md`; plan tasks P1-T02, P2-T11, P2-T20, P5-T10, P5-T11

## Problem

Reading both migrations against a scratch Postgres turned up twelve defects that could be reproduced and several gaps against decisions D-235 to D-251. Nothing from either file is applied to a real project, so the files can still be edited (`AGENTS.md` rule 4 freezes a migration only once it is applied).

The reproduced defects: a client could read its whole `projects` row (token budget, round plan, GitHub repo, Vercel project id); an upload row could point at another project's storage path; a comment could point at another project's artifact; the owner could insert an approval for anyone, with any role, in any project state; approvals could be post-dated or duplicated; an artifact's content could be rewritten after approval; the owner (and the API) could insert a project at any stage or set `status`, `close_reason` and `retention_until` by hand; any client login counted at a client gate; the service role could call `advance_stage()`; the close step set no `retention_until` and ignored an undeployed change request; `anon` and `authenticated` could run internal helper functions; and deleting a login would have been blocked by the approvals foreign key.

## Proposed change

The owner answered five questions in chat on 2026-10-15 and then said "Go, for 0001, 0002 and spec update all in one PR with different commits". This proposal records exactly what that covers.

Owner answers:

1. Client access to owner-only project fields is blocked in the database (not only in the app).
2. One routine closes a project (`close_project()`), and guards stop the API from closing, reopening or creating a closed project by hand.
3. Owner-only fields move to a separate table, `project_internal`; the erase function is narrower than "delete the project".
4. Artifact versions are immutable; an `erase_project_data()` function is the only way to blank a handover guide; `approvals.approved_by` becomes nullable with `on delete set null`.
5. The fixes are made in `0001` and `0002` in place.

Changes in `0001` and `0002` (the rest of the migration review list, which the owner approved with "Go"):

- `project_internal` (github_repo, vercel_project_id, token_budget, round_plan, retention_days, retention_until, data_deleted_at), created by a trigger, owner-only. `projects` gains `changes_frozen_at` (the change-request freeze, D-238).
- `clients.is_signer` with a partial unique index (one signer per project, D-238); only the signer's approval counts and only the signer can insert a client approval. If the owner changes the signer, the former signer's approvals stop counting.
- `run_status` gains `stopped` (D-232).
- `close_project(project, reason)`: sets status, close_reason and `retention_until` (now plus `retention_days`, default 90); a completed close is refused while an accepted change request is undeployed (D-237). Not callable from the API. `advance_stage()` calls it at handover; the cancel function (P2-T20) will call it with `cancelled`.
- `erase_project_data(project)`: owner or service role; only for a closed project whose `retention_until` has passed; deletes `uploads` rows, intake rounds and answers, run logs and the project's `email_log` rows, blanks the handover guide's content, sets `data_deleted_at`. It keeps approvals, the other artifacts and the project row. The caller deletes storage objects first.
- Artifacts: id, project, type, version and content never change after they are written.
- Approvals: owner policy allows only the owner's own owner-role approval on an artifact of an active project; the database sets `at` for API writes; one approval per giver, gate and artifact; the giver is cleared (row kept) when a login is deleted; a null giver never counts.
- `advance_stage()` is owner-only (the worker no longer advances projects).
- A handover guide can be client-visible only after the owner's hard approval (D-251).
- `uploads.storage_path` must start with the project id; `comments` and `prd_feedback` use a composite foreign key so their artifact belongs to the same project.
- Client change-request inserts are refused once `changes_frozen_at` is set.
- `anon` gets no table or function privileges (default privileges and explicit revokes); `close_project()` and `approval_is_valid()` are not callable from the API.
- Test harness: `stub_auth.sql` sets Supabase's default privileges before the migrations; `review_suite.sql` (57 checks) is new; each new rule was broken on purpose and a check failed (see `PROGRESS.md`).

Spec and plan edits (applied in the third commit of the same PR):

- `docs/spec/10-data-model.md`: the `projects`, `clients`, `approvals` and `artifacts` rows, a new `project_internal` row, and the "Also in the model" paragraph (field names are now fixed).
- `docs/spec/03-pipeline-and-gates.md`: approval times are set by the database.
- `docs/spec/15-operations.md`: the retention job calls `erase_project_data()` after it removes the storage files.
- Plan: table count 24 (P1-T02 and the owner steps); P2-T11 (the signer is in `0001`, no later migration); P2-T20 (cancel calls `close_project()`); P5-T10 (the freeze field exists); P5-T11 (the job uses `erase_project_data()`).
- `DECISIONS.md`: D-252 to D-256.

## Options considered

- Option A: edit `0001` and `0002` in place (chosen). Cleaner history; possible because nothing is applied.
- Option B: add `0003` and later hardening migrations. Matches the frozen-once-merged habit but leaves the defects in the applied history and adds patch files.
- Option C: hybrid. Rejected.

Not done here, on purpose: a typed `artifacts.type` (the list of types is still open), extra `stage_runs` columns for parked runs (the spec says they are decided with that migration), `accept_gate` and the remaining-gates function (P2-T18), the cancel function (P2-T20) and the commands table (D-249). D-238's rule that new versions of a stage's artifacts are blocked after the project advances is also still open; it belongs with `accept_gate`.

## Impact

`0001` now creates 24 tables. The generated types and the table-count test are updated. `AGENTS.md` rule 4 asks for one PR per migration; the owner chose one PR with a commit each for `0001`, `0002` and the spec for this review only.

## Owner decision

Accepted in chat on 2026-10-15: the five answers above, and "Go, for 0001, 0002 and spec update all in one PR with different commits, see to it nothing is breaking after these updates."
