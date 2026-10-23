# Proposal: align the data model spec with the gate functions (P2-T18)

- **Status:** open
- **Date:** 2026-10-22
- **Raised by:** agent, while building P2-T18
- **Task or spec reference:** P2-T18; `docs/spec/10-data-model.md` (artifacts and approvals rows); D-258, D-261

## Problem

P2-T18 adds a `rejected` artifact status (the owner chose this in chat on 2026-10-22: "Add rejected status and reject_gate here") and makes `accept_gate` the only writer of approvals, as the owner chose ("Only through accept_gate"). The data model spec still lists the artifact statuses as draft, approved, superseded and does not say who writes approvals. `docs/spec/03-pipeline-and-gates.md` already says "Reject marks the version rejected" and describes `accept_gate`, so only the data model file differs.

## Proposed change

In `docs/spec/10-data-model.md`:

1. artifacts row: change "status (draft, approved, superseded)" to "status (draft, approved, rejected, superseded)".
2. approvals row: after "Immutable approval log;" add "written only by `accept_gate` (no API role inserts into it);".

No other spec file changes.

## Options considered

- Option A (proposed): the two edits above.
- Option B: leave the data model file as it is. The code and the spec then disagree on the statuses.

## Impact

`docs/spec/10-data-model.md` only. Consequence worth knowing: until the change-request work builds its own path, nothing can record the owner's hard-gate approval on a `release_note` artifact (D-223), because the old direct insert is gone; that path is added with the release-note task.

## Owner decision

(Left blank for the owner.)
