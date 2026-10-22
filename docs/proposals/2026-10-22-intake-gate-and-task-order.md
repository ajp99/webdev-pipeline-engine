# Proposal: intake gate needs a settled round, gates before owner review, fixed style cards in development

- **Status:** accepted (2026-10-22)
- **Date:** 2026-10-22
- **Raised by:** agent, from the independent review of `complete_intake_review` (P2-T05) and the owner's answers in chat on 2026-10-22
- **Task or spec reference:** P2-T05, P2-T06, P2-T15, P2-T18; `docs/spec/04-intake.md` step 7; D-182, D-189, D-304

## Problem

1. **Intake gate.** `advance_stage()` approves the newest `intake_record` and never looks at the rounds. After a review with follow-ups, round 2 is open; the owner could approve the first record and accept intake while the client's follow-up answers were never entered or reviewed. The spec does not say what accepting intake requires.
2. **Order.** P2-T06 ends with "accept intake (soft gate)", but the gate functions are P2-T18 and the gate controls P2-T19, which come after it in the D-304 order. T06 could not be finished or shown working.
3. **Style samples.** D-182 and D-189 have an agent propose 4 style directions and build each as a standalone sample page rendered to an image (P2-T15). That needs a page generator, a headless browser on the owner's machine and an approval flow, for a form that already asks the design questions.

## Proposed change

The owner has already answered each point in chat on 2026-10-22 (intake gate: "Yes, require it"; order: "Reorder the plan"; samples: "Fixed style cards for now"). This proposal asks for approval of the exact text.

1. **`docs/spec/04-intake.md`, step 7**, add at the end: "Intake can be accepted only when the latest round is reviewed and no follow-up round is waiting: if a review opened a follow-up round, that round must be answered, submitted and reviewed first. The accept control is unavailable while the latest round is open or submitted. `accept_gate` enforces this for the intake stage."
2. **`docs/plan/phase-2-intake-and-prd.md`, part 2a order**, change "P2-T05, P2-T06, P2-T15, P2-T18, P2-T19, P2-T20, P2-T21, P2-T23" to "P2-T05, P2-T18, P2-T19, P2-T06, P2-T15, P2-T20, P2-T21, P2-T23". A new decision supersedes the order in D-304. P2-T18 gains the rule in item 1 as an acceptance clause.
3. **P2-T15** in development ships four fixed, generic style cards with images kept in the repo (minimal, bold, warm, corporate), shown by the form. The agent-proposed directions and rendered sample pages move to go-live as a new item (G30). A new decision supersedes D-182 and D-189 until G30. The acceptance text of P2-T15 is changed to match.
4. Three new decisions in `DECISIONS.md` (next free numbers) record items 1 to 3; G30 is added to `docs/plan/go-live-readiness.md`.

## Options considered

- Option A (proposed): all three as above.
- Option B: leave the gate to the owner's judgment. Simple, but a skipped follow-up round is easy to miss and nothing records it.
- Option C: keep the D-304 order and ship T06 without an Accept button. Works, but the Accept button then arrives two tasks later and T06 is never shown whole.
- Option D: build the sample-page generator now. Matches D-182 and D-189, but adds a browser dependency and a second model role before the walking skeleton.

## Impact

`docs/spec/04-intake.md`; `docs/plan/phase-2-intake-and-prd.md` (order, P2-T15, P2-T18); `DECISIONS.md`; `docs/plan/go-live-readiness.md`. No schema change in this PR; the accept check is built in P2-T18's own migration PR.

## Owner decision

Approved as written by the owner in chat on 2026-10-22 ("Approve as written"), with the edits in this same PR (#39), at the owner's request. Applied as decisions D-317 (order), D-318 (intake gate) and D-319 (fixed style cards), go-live item G30, and the edits to `docs/spec/04-intake.md` and the phase file.
