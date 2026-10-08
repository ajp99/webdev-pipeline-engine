# Proposal: align the spec with how phase 1 was built

- **Status:** open
- **Date:** 2026-10-08
- **Raised by:** agent (phase 1 build)
- **Task or spec reference:** P1-T06, P1-T07; `docs/spec/stages.yaml`, `docs/spec/10-data-model.md`, `docs/spec/03-pipeline-and-gates.md`, `docs/spec/12-security.md`

## Problem

Building `advance_stage()` and the approval queue needed choices the spec does not state. The owner approved the first one (artifact mapping) in chat on 2026-10-08; the rest came out of the branch review and are in the code and tests but not in the spec. Spec files are read-only for agents, so they are listed here.

## Proposed change

1. **Which artifact gates each stage** (owner approved): `intake_record`, `prd`, `plan`, `prototype`, `report`, `deployment_checklist`, `handover_guide`. `stages.yaml` `outputs` still lists other names (`prototype_preview`, `handover_pack`, ...). Either align `outputs` or add a field `gate_artifact` per stage. The queue code and `advance_stage()` use the list above, and a test keeps them equal.
2. **Build rounds:** each round's summary is an artifact of type `round_summary` carrying `{"round": N}` in its content. Feedback on a round makes a new version of the same round's summary; versions rise across rounds because they are unique per project. A round passes with a soft approval on its newest summary.
3. **Who counts as an approver:** `advance_stage()` accepts an approval only if an owner gave an owner-role approval, or a client of that project gave the client approval. Approval timestamps cannot be in the future. The client signs the prototype only after the owner approved that version (migration 0002 changes the client approval policy for this).
4. **Advancing after a client gate:** nothing advances automatically, so after the client signs off the PRD (or the owner's Accept could not finish advancing) the project shows in the owner's queue as "Ready to advance" with an Advance button. Spec 03 says "Accept approves and advances", which holds for owner gates only.
5. **Public sign-ups off:** Supabase Auth must have "Allow new users to sign up" turned off; logins come from the owner bootstrap script or the client invite. Add to `12-security.md`.
6. **Not built yet:** cancelling a project (`close_reason = cancelled`) is not an advance and has no function yet; the console needs one (phase 2 or a task of its own). `retention_until` is not set at close; P5-T05 owns the retention date.

## Options considered

- Option A: update the spec files to match (needs the owner to apply or approve the edits).
- Option B: leave the spec as is and treat the code, the tests and this proposal as the record.

## Impact

`stages.yaml`, `10-data-model.md`, `03-pipeline-and-gates.md`, `12-security.md`; migration `0002_advance_stage.sql`; `packages/shared/src/queue.ts`; `apps/web/src/app/owner/queue/`.

## Owner decision

(Left blank for the owner.)
