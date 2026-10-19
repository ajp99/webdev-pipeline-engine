# Proposal: Approver identity as an email snapshot without a foreign key (S7)

- **Status:** accepted (2026-10-19)
- **Date:** 2026-10-19
- **Raised by:** Claude Code, from the owner's answer in the breakage review
- **Task or spec reference:** spec 10 (`approvals`), D-309

## Problem

Spec 10 says `approved_by` is cleared when the person's login is deleted. The owner chose, on 2026-10-19, to keep only the email snapshot and the user id as plain data, without a foreign key.

## Proposed change

In `docs/spec/10-data-model.md`, in the `approvals` row, replace "`approved_by` is cleared (the row stays, the snapshot stays) if the person's login is deleted, and such a row no longer counts" with "`approved_by` is the giver's user id kept as plain data with no foreign key, so the row and the snapshot stay if the login is deleted; such a row stops counting because its giver is no longer in `owners`". The column list is unchanged. The squashed `0001` drops the foreign key and the `on delete set null`.

## Options considered

- Option A: as above (the owner's choice).
- Option B: keep the nullable foreign key. Rejected by the owner.

## Impact

Spec 10 only, one sentence. The squash migration and its mutation (a deleted giver no longer counts) follow.

## Owner decision

The owner chose "email snapshot only" in chat on 2026-10-19 and, after the plain-language explanation, kept the proposed sentence, including that a row whose giver is deleted stops counting. Applied in the same PR as the plan changes (#21), as the one-time exception granted by the owner on 2026-10-19; the spec file changed is `docs/spec/10-data-model.md` only.
