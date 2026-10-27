# Proposal: gate feedback table and Feedback rules in the spec

- **Status:** open
- **Date:** 2026-10-27
- **Raised by:** agent (P2-T19)
- **Task or spec reference:** P2-T19; `docs/spec/10-data-model.md`, `docs/spec/03-pipeline-and-gates.md`

## Problem

P2-T19 adds Feedback. The owner chose these rules in the question rounds of 2026-10-27: Feedback notes go in a new `gate_feedback` table; the version keeps its status (it stays a draft, or stays rejected); Feedback may be sent more than once on one version (each press is a loop); a run is queued in the same transaction when the stage has an agent; Feedback is offered at every stage with the caps of spec 03. The data model in spec 10 has no table for these notes. Spec 03 does not say that the version stays a draft or how loops are counted. The plan line for P2-T19 says "Feedback works on the soft gates", but spec 03 caps Feedback on the PRD (a client gate), deploy prep and the handover guide (hard gates).

## Proposed change

1. `docs/spec/10-data-model.md`, after the `prd_feedback` row, add:

   `| gate_feedback | The owner's Feedback on an artifact waiting at a gate; one row per loop; append-only, written only by feedback_gate(); the agent reads it | project_id, artifact_id, round, body, created_by, created_at |`

2. `docs/spec/10-data-model.md`, rounds row: `feedback_count (at most 3)` becomes `feedback_count (at most 3, kept by feedback_gate)`.

3. `docs/spec/03-pipeline-and-gates.md`, in "Loops and limits", after the "Feedback caps" line, add:

   `- Feedback is recorded by one database call (feedback_gate), owner session only. The version keeps its status: a draft can still be accepted or rejected, and a rejected version can get Feedback. Each Feedback is one loop, counted per artifact type (per round for build rounds) across all its versions; once the cap is used, only Accept or Reject is left. On the QC report the cap is its 2 fix loops. When the stage has an agent, a run is queued in the same transaction unless one is already queued.`

4. `docs/plan/phase-2-intake-and-prd.md`, P2-T19 acceptance: "Feedback works on the soft gates" becomes "Feedback works at every gate stage".

## Options considered

- Option A (chosen by the owner in chat): a new `gate_feedback` table.
- Option B: reuse `owner_notes` with an artifact column. Mixes private notes with gate feedback.
- Option C: count versions only. Fails for intake, where each round review makes a version.

## Impact

Spec 10 and spec 03 text; the P2-T19 plan line. The code is already built this way (migration PR for P2-T19). `rounds.feedback_count` stays as in spec 10 as a mirror: `gate_feedback` rows are what the cap counts, and a trigger lets only `feedback_gate` change the column, so the two cannot disagree. Spec 10's rounds row could say "feedback_count (at most 3, kept by feedback_gate)".

## Owner decision

(Left blank for the owner.)
