# Proposal: a missing logo is flagged, not blocking

- **Status:** open
- **Date:** 2026-10-29
- **Raised by:** agent (P2-T15)
- **Task or spec reference:** P2-T15; `docs/spec/04-intake.md` (step 2), `docs/plan/phase-2-intake-and-prd.md` (P2-T15 acceptance), D-184

## Problem

Spec 04 step 2, the P2-T15 acceptance and D-184 say the intake "requires a logo upload or an explicit answer that there is none". The generic template marks the logo question `required`, so Submit is blocked until one of the two is given. In the question round of 2026-10-28 the owner chose "Warning only" for a missing logo. The same spec paragraph already says that "everything else is optional, and missing items are flagged, not blocking", so the logo wording is the odd one out.

## Proposed change

1. `docs/spec/04-intake.md`, step 2: "and requires a logo upload or an explicit answer that there is none" becomes "and asks for a logo upload or an explicit answer that there is none; a logo with neither is flagged to the owner, and Submit is not blocked".
2. `docs/plan/phase-2-intake-and-prd.md`, P2-T15: "and requires a logo upload or an explicit answer that there is none" becomes the same wording.
3. `DECISIONS.md`: a new decision that refines D-184: the logo is asked for, flagged when missing, and never blocks Submit; the wordmark fallback stays.

The code is built this way in the next app PR: the generic template's logo question is `required: false` with `none_allowed: true`, and the intake page lists an unanswered logo as a warning.

## Options considered

- Option A (the owner's answer of 2026-10-28): warning only.
- Option B: keep the logo required, as the spec says today. A client who has no logo and does not say so cannot submit.

## Impact

Spec 04 text, the P2-T15 plan line, one new row in `DECISIONS.md`; the generic template and the intake page (already changed in the app PR).

## Owner decision

(Left blank for the owner.)
