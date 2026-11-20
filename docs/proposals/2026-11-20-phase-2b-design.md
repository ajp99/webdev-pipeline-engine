# Proposal: Phase 2b design decisions (PRD, sign-off, change requests)

- **Status:** accepted
- **Date:** 2026-11-20
- **Raised by:** agent (start of Phase 2b)
- **Task or spec reference:** P2-T07 to P2-T10, P2-T24; `docs/spec/05-requirements-and-change-control.md`, `docs/spec/06-agents-skills-tools.md`, `docs/spec/10-data-model.md`

## Problem

Phase 2b builds the PRD, the owner-recorded client sign-off and change requests. The spec and the plan leave five points open or say something the dev-only scope cannot do as written:

1. Spec 05 and P2-T08 say the agent writes a summary of what changed for each new PRD version. Owner-edited versions are saved in the console, which holds no model key (AGENTS.md), and the worker only runs stage runs. The spec does not say how an owner edit gets its summary.
2. P2-T08 says "every saved version is recorded in the approval log". The approval log (`approvals`) is written only by `accept_gate` and records approvals, not edits.
3. The PRD shape is "a fixed list of structured sections" with the privacy policy, the cookie notice and the spam protection choice, but which keys and which checks the database enforces is not written down.
4. Change requests: when they can be recorded in dev-only, which decisions are open before go-live (D-174 makes `accept_mini_round` a go-live mechanism), how an accepted request bumps the PRD, and whether the bumped version needs a new sign-off.
5. The owner can insert an artifact row with any status through the API (the `owner_all` policy), so a row could be written as `approved` without an approval. Gate safety still holds (`advance_stage` checks approvals, not status), but the status column can lie.

## Proposed change

1. **Change summary (D-324).** Until go-live, an owner-saved PRD version carries a summary the owner writes when saving (required, at most 1000 characters; the console prefills it with the list of changed sections). Agent-drafted versions carry the agent's summary of the change from the previous version. The agent-written summary of owner edits moves to go-live item G32. Spec 05 gets a line in its dev-only note.
2. **Version history (D-324).** Each saved version is an immutable `artifacts` row with its author (`created_by`, the owner's user id, or empty for the worker) and its time; the console lists them as the version history. The approvals table is unchanged. The P2-T08 line is reworded to say this.
3. **PRD shape (D-325).** `content` is `{ "sections": { "business", "site_map", "features", "content", "brand", "non_functional" }, "spam_protection", "change_summary" }`: six non-empty markdown strings, one per spec 05 bullet; `spam_protection` is one of `honeypot`, `turnstile`, `no_contact_form`; `change_summary` a string (empty only for the first version). The database refuses a PRD whose site map does not name a privacy policy and a cookie notice. The owner-only gap and conflict list is a separate artifact of a new type `prd_notes` (`{ "gaps": [...], "conflicts": [...] }`), written in the same call as the PRD draft.
4. **Change requests in dev-only (D-326).** The owner records a request only after the PRD is signed (the project is past the requirements stage), while the project is active and before `changes_frozen_at`. Each request has a description, affected pages and affected features. The owner sets the impact note and one of three decisions: accept into the current round, defer, decline (`accept_mini_round` stays a go-live decision, D-174). An accepted request allows exactly one new PRD version tied to it; that version needs no new sign-off, because the owner's decision is the approval. Version labels are computed for display: the signed version is v1.0, each version after it from a change request is v1.1, v1.2 and so on; versions before the sign-off are drafts 1, 2, ...
5. **Artifact status (D-327).** An artifact inserted through the API is always a draft. The owner saves PRD versions only through a new function, `save_prd_version`, which checks the stage, the base version, the content and the change request.

## Options considered

- For 1: (A, chosen) the owner writes the summary in dev-only; (B) a new worker job that summarises owner edits, a second polling path and a model call for each save; (C) the console shows only the changed-section list. B is the go-live design; C gives the client nothing readable.
- For 4: (A, chosen) no new sign-off for a change-request version; (B) every bumped PRD goes back to the client gate. B reopens a stage the project has left, which the gate model does not allow (D-238).

## Impact

Spec 05 (dev-only note), the P2-T08 and P2-T10 plan lines, `DECISIONS.md` (D-324 to D-327), go-live items G15 (client policies must hide `prd_notes`) and G32. The schema changes (new artifact type, `artifacts.created_by`, change-request columns, `save_prd_version`, `decide_change_request`, content checks) come in the Phase 2b migration PR with its own independent review.

## Owner decision

Accepted under D-321 (the owner's delegation of 2026-11-20), as written.
