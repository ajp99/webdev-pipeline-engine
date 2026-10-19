# Proposal: Spec follow-ups after the Phase 2a re-baseline (backups, leftover client text)

- **Status:** accepted (2026-10-19)
- **Date:** 2026-10-19
- **Raised by:** Claude Code, from the review after PR #20
- **Task or spec reference:** spec 00, 15; D-297

## Problem

D-297 moved the backup script and restore proof (P1-T10, P1-T15) to go-live (G6), but `00-overview.md` (Operations row) and `15-operations.md` (database export section) still say exports run on a schedule and before each project close. PR #20 left them alone because they were outside the accepted proposal.

## Proposed change

In `00-overview.md` and `15-operations.md`, state that the encrypted export script and the restore proof are go-live items (G6); until then nothing is exported because there is no real data. No other wording changes.

## Options considered

- Option A: edit the two spec places as above.
- Option B: leave the spec as the go-live design and rely on G6 alone. Risk: a reader of the spec thinks backups exist now.

## Impact

Spec 00 and 15 only. No task, table or code change.

## Owner decision

Accepted by the owner in chat on 2026-10-19: Option A, backups are a go-live item and nothing is exported now (D-307). The two spec edits are made in their own spec-only PR.
