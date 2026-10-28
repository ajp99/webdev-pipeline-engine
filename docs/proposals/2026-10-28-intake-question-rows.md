# Proposal: follow-up questions are rows of intake_responses

- **Status:** open
- **Date:** 2026-10-28
- **Raised by:** agent (P2-T06)
- **Task or spec reference:** P2-T06; `docs/spec/10-data-model.md`, `docs/spec/04-intake.md`

## Problem

Spec 04 (step 7) lets the owner add or remove questions before accepting intake. Today the text of an agent follow-up lives only in the immutable `intake_record` artifact, and `intake_responses` holds only answers, so a question can be neither removed nor added by the owner. The owner chose in the question round of 2026-10-28 to keep "add" in scope and to give each follow-up its own row.

## Proposed change

`docs/spec/10-data-model.md`, the `intake_responses` row becomes:

`| intake_responses | Answers by round, and the text of every follow-up question; the owner's edits overwrite; the owner can add questions and remove follow-ups; a client can change only the answer, not the round, question or origin | project_id, round, question_id, answer, asked_by (template, agent or owner), question (text of a follow-up; empty for a template question) |`

No change to `docs/spec/04-intake.md`: step 7 already says the owner may add and remove questions. The agent's follow-ups are saved as rows when the review is saved (ids `fu<round>_<n>`); owner questions use ids `ow<round>_<n>`. The question text is at most 500 characters. The immutable `intake_record` keeps what the agent asked.

## Options considered

- Option A (chosen by the owner): the question text goes in `intake_responses`.
- Option B: a separate `owner_questions` table plus a list of removed ids; two sources to merge everywhere.
- Option C: drop add/remove (changes spec 04).

## Impact

Spec 10 row text. The code is built this way in the P2-T06 migration PR.

## Owner decision

(Left blank for the owner.)
