# Proposal: Phase 1 close-out and Phase 2a re-baseline (no client login, cancel-only runs)

- **Status:** accepted (2026-10-19)
- **Date:** 2026-10-19
- **Raised by:** Claude Code, from the owner's answers in the planning rounds of 2026-10-19
- **Task or spec reference:** P1 gate, P2-T01 to P2-T24; spec 02, 03, 04, 05, 06, 07, 10, 11, 12, 15 and `gates.yaml`

## Problem

The spec and plan assume client logins, client emails, a commands table with Pause and Resume, parked runs, retention timers and containers for every agent run. The owner has decided (D-297 to D-304) that development stays dev-only with fictional clients, so most of that is dead weight before the first real client. The plan files are updated by this PR's plan patch. The spec files still say the old thing and may not be edited without an accepted proposal (AGENTS.md rule 2).

## Proposed change

Already in this PR (plan, decisions, go-live; not spec): decisions D-297 to D-304, the Phase 1 gate wording, the Phase 2 task changes (T02, T03, T04, T05, T11, T12, T13, T16, T20, T21, T22 and the part descriptions), and go-live items G15 to G18.

To apply after acceptance, in a spec-only PR, exactly these edits:

1. **spec 10 (data model):** remove `clients`, `is_signer`, `client_visible` and the client RLS; remove `parked` from `run_status` and `parked_at`; remove `retention_until` and `erase_project_data`; add `cancel_requested` to `run_status`; add a required `approvals.evidence_note` for client-gate approvals. Note the claim function and the one-active-run index.
2. **spec 03 and `gates.yaml`:** keep the `client` gate type; its approval is entered by the owner (`accept_via: [console]`, actor owner) with a required note. `approval_is_valid()` accepts a client-role approval when its giver is an owner and the note is not empty.
3. **spec 04, 05, 11:** intake and PRD sign-off are entered by the owner; remove the client dashboard, invites, privacy page and first-login text, and mark them go-live.
4. **spec 12:** remove client RLS and client login rules; replace "each run in its own container" with "the Builder runs in a container with a repo mount and open network; other agents run on the host" (D-300); correct the line saying secret scanning is already on (P1-T11 is still open).
5. **spec 02, 06, 07:** replace the commands-table and parked-run text with the `cancel_requested` flag; remove the webhook and per-run-container wording that no longer applies.
6. **spec 15:** `WORKER_MAX_PARALLEL_PROJECTS` default 1, one 20-minute watchdog, no backup script before go-live.

## Options considered

- Option A (this proposal): adopt D-297 to D-304.
- Option B: keep the spec as written and build the client side now. Rejected by the owner: it carries a large hardening and test surface for a system with no clients.
- Option C: adopt the full MVP simplification proposal (six stages, hard-coded gates). Partly rejected: stages and `gate_config` stay (D-299).

## Impact

Spec files: 02, 03, 04, 05, 06, 07, 10, 11, 12, 15, `gates.yaml`, and `00-overview.md` where it lists locked decisions. Tasks: see the plan patch. Code: the squashed `0001` drops the client-side schema, parked runs and retention; about a third of the mutation files go with it; the claim function and the `cancel_requested` flow are new rules that each need a mutation (rule 5). `apps/worker/.env.example` default parallelism changes from 2 to 1.

## Conflicts found while preparing this patch

These are real mismatches between the owner's answers and existing text. None is silently resolved.

1. **Container isolation.** Spec 12 line 7 requires every agent run in its own container with limited egress. D-300 (Builder only, open network, host agents with Bash) contradicts it. Host agents read client-supplied text, so prompt injection is the accepted risk. Open question: at least deny Bash for PRD and Planner on the host, or keep it as chosen?
2. **Client gate without a client.** `approval_is_valid()` in `0002` accepts a client-role approval only from the named signer. Owner-entered approvals need a new rule (change 2 above) or advance stops working at the requirements and prototype gates.
3. **Requirements gate.** `gates.yaml` gives the requirements stage a `client` gatekeeper, so the PRD cannot advance until change 2 lands.
4. **Part 2b gate** and **P2-T22** said "test client signs off" and "second email". Both are reworded in this patch.
5. **Later phases.** Phase 3, 4 and 5 files mention the client dashboard (7, 8 and 8 times). They are not edited here; they need a pass after acceptance.
6. **Cancel and retention.** `close_project()` and `advance_stage()` at handover set `retention_until` and refuse while an accepted change request is undeployed (D-237). D-303 removes retention, so `close_project()` changes; the undeployed-change-request refusal is kept.
7. **Phase 5.** P5-T11 "Run retention now" uses the commands table that D-301 defers.
8. **Parked runs.** `parked` appears in spec 00, 07, 10, 11, 12, 14, 15 and the Phase 4 plan.
9. **Gate demonstration (P1-T09)** may use a client approval; it must run on the owner path before the gate.
10. **Mutation files** for client rules become stale on the squash and are deleted with the schema (the script exits 3 on a stale file).
11. **Secret scanning.** Spec 12 says it is on, P1-T11 says it is not. Fixed by change 4.
12. **Uncommitted changes** found on `main` on 2026-10-19 (approval-giver guard, no-truncate triggers, mutations 136 to 143) were discarded by the owner. The same ideas can return as rules in the squash.

## Owner decision

Accepted by the owner in chat on 2026-10-19, with these answers: host agents keep Bash unrestricted as in D-300 (conflict 1, to be closed before the first real client); an owner-entered client approval keeps role `client`, its giver is an owner, and a CHECK requires a non-empty `evidence_note` (conflict 2); the secret-scanning sentences in specs 00, 12 and 15 say "to be turned on" until P1-T11 is ticked (conflict 11). The spec edits are made in their own spec-only PR; the Phase 3 to 5 plan pass and the extra go-live item for host-agent isolation follow in a plan PR.
