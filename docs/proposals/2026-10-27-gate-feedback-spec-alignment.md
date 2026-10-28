# Proposal: gate feedback table and Feedback rules in the spec

- **Status:** open
- **Date:** 2026-10-27 (revised 2026-10-28 after the owner's review of PR #42)
- **Raised by:** agent (P2-T19)
- **Task or spec reference:** P2-T19; `docs/spec/10-data-model.md`, `docs/spec/03-pipeline-and-gates.md`, `docs/spec/gates.yaml`

## Problem

P2-T19 adds Feedback. The owner chose these rules in question rounds on 2026-10-27 and 2026-10-28:

- Feedback notes go in a new `gate_feedback` table, one row per loop, and the rows are the only count. `rounds.feedback_count` is removed.
- Feedback is given only on a draft, which stays a draft (Accept and Reject still work). A rejected version gets no Feedback: the owner waits for a new version or edits by hand.
- Feedback may be sent more than once on one version; each press is a loop.
- A run is queued in the same transaction when the stage has an agent.
- Feedback is offered at every gate stage.
- The caps live in `gate_config`, on each stage's first gate row: 3 on intake, PRD, plan, deploy prep and handover; 2 on the prototype and QC; 3 per build round. A project's own row may set its own cap; a global cap changes only through a migration.

The spec does not say any of this yet. Spec 10 has no table for the notes and lists `rounds.feedback_count`. Spec 03 says that after Reject the owner "uses Feedback or edits by hand". `gates.yaml` has no cap. The plan line for P2-T19 says "Feedback works on the soft gates", but spec 03 caps Feedback on the PRD (a client gate), deploy prep and the handover guide (hard gates).

## Proposed change

1. `docs/spec/10-data-model.md`:
   - After the `prd_feedback` row, add:

     `| gate_feedback | The owner's Feedback on a draft waiting at a gate; one row per loop (the loop count); append-only, written only by feedback_gate(); the agent reads it | project_id, artifact_id, round, body, created_by, created_at |`

   - In the rounds row, remove `feedback_count (at most 3), `.
   - In the gate_config row, add `feedback_cap` to the columns.

2. `docs/spec/03-pipeline-and-gates.md`:
   - In the first paragraph, "Reject marks the version rejected and starts no run; the owner then uses Feedback or edits by hand" becomes "Reject marks the version rejected and starts no run; the owner then waits for a new version or edits by hand".
   - In "Loops and limits", after the "Feedback caps" line, add:

     `- Feedback is recorded by one database call (feedback_gate), owner session only, on the newest draft, which stays a draft. Each Feedback is one loop, counted per stage (per round for build rounds) across all versions; once the cap is used, only Accept or Reject is left. On the QC report the cap is its 2 fix loops. The caps live in gate_config (feedback_cap on the stage's first gate row); a project's own row may set its own cap, and a global cap changes only through a migration. When the stage has an agent, a run is queued in the same transaction unless one is already queued.`

3. `docs/spec/gates.yaml`: add `feedback_cap` to the first approval of each stage (intake 3, requirements 3, plan 3, prototype soft 2, build_rounds 3, qc_report 2, deploy_prep 3, handover 3). The consistency test then compares the caps too.

4. `docs/plan/phase-2-intake-and-prd.md`, P2-T19 acceptance: "Feedback works on the soft gates" becomes "Feedback works at every gate stage, on drafts".

## Options considered

- Option A (chosen by the owner): a new `gate_feedback` table, with the rows as the only count.
- Option B: reuse `owner_notes` with an artifact column. This mixes private notes with gate feedback.
- Option C: count versions only. This fails for intake, where each round review makes a version.

## Impact

Spec 10, spec 03 and gates.yaml text; the P2-T19 plan line; the consistency test (caps). The code is already built this way (PR #42).

## Owner decision

(Left blank for the owner.)
