# Proposal: design of the Phase 2 database migrations (types, parked runs, gates, cancel, commands)

- **Status:** accepted (2026-10-15)
- **Date:** 2026-10-15
- **Raised by:** agent, from the open items of `2026-10-15-migration-review.md`
- **Task or spec reference:** P2-T18, P2-T20, P2-T21; `docs/spec/10-data-model.md`, `15-operations.md`; D-238, D-239, D-249

## Problem

Five items were left open after the migration review: the artifact type list, how a parked run is recorded, `accept_gate` and the remaining-gates function, the cancel function and the commands table, and the D-238 rule that blocks new versions after a stage has advanced.

## Owner decisions (chat, 2026-10-15; every answer was the recommended option)

1. **Artifact type** is an enum with 14 values: `intake_record`, `prd`, `plan`, `skill_set`, `round_scope`, `prototype`, `round_preview`, `round_summary`, `backlog`, `qc_results`, `report`, `deployment_checklist`, `handover_guide`, `release_note`. New values come with the task that needs them, as forward migrations.
2. **Parked runs:** a new `run_status` value `parked` and a `stage_runs.parked_at` column. `waiting` keeps the slot; `parked` frees it, keeps the working folder and branch, and can be resumed.
3. **`accept_gate`:** when the owner's accept completes the last missing gate, it records the approval, marks the artifact approved and advances in one transaction. Otherwise it records and returns that it is waiting on the client. A client sign-off never advances; the owner's Advance button calls `advance_stage()`.
4. **Version block (D-238):** a before-insert trigger on `artifacts` refuses a new version of a gated type once the project is past that stage, unless the row names an accepted change request of the same project in `artifacts.change_request_id`. `release_note` and `round_summary` during `build_rounds` are exempt.
5. **Cancel (P2-T20):** `cancel_project(project, reason)` calls `close_project(cancelled)`, requires a non-empty `project_internal.cancel_reason`, leaves the stage where it was, marks queued runs `cancelled`, and inserts a `cancel` command for each running, waiting or parked run.
6. **Commands table (D-249):** `worker_commands` with a `kind` enum (`retry`, `cancel`, `resume`, `end_run`, `run_retention`), `project_id` and `run_id` nullable per kind (a check), requester and time, claimed-by and time, finished time and error; a partial unique index allows one open command per kind and target; only the owner inserts; the worker claims with `FOR UPDATE SKIP LOCKED`.
7. **Remaining gates:** an owner-only function returning one row per gate: `gate_type`, `gatekeeper`, `state` (satisfied, missing, blocked until the owner approves first), artifact id and version, `due_at`, overdue flag, and a `ready_to_advance` boolean. Clients keep reading their own artifacts and approvals through RLS.

## Proposed change

Schema items 1, 2 and the two columns they need (`artifacts.change_request_id`, `project_internal.cancel_reason`) are folded into `0001` in the same PR as the migration review, because nothing is applied. Items 3 to 7 are logic and tables that stay in later migrations, each in its own PR with an independent review:

- P2-T18: remaining-gates function, `accept_gate`, the version-block trigger.
- P2-T20: `cancel_project()` (needs the commands table first, so it follows P2-T21's migration).
- P2-T21: `worker_commands`.

Spec and plan edits: `10-data-model.md` (types, `parked_at`, `cancel_reason`, `change_request_id`, the commands table's shape), `15-operations.md` (parked runs), and the acceptance lines of P2-T18, P2-T20 and P2-T21. `DECISIONS.md` D-257 to D-262.

## Options considered

Each question had two or three options; the rejected ones were a lookup table or free text for types, reusing `waiting` or a separate table for parked runs, a flag or a never-advance `accept_gate`, a security-definer-only path or an app-only check for D-238, cancelling into stage `closed` or a worker-side close, a payload column or expiry for commands, and a signer-readable or booleans-only gates function.

## Impact

`0001` gains an enum and three columns; the generated types and the schema-fact checks change (271 checks pass). Later migrations: one for P2-T18, one for the commands table and one for cancel. Cancel depends on the commands table, so P2-T20 now follows P2-T21's migration.

## Owner decision

Accepted in chat on 2026-10-15 ("go"), with the seven answers above.
