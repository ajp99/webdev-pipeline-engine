# Judge calibration (P3-T10)

The judge's scores count only as far as they agree with the owner's own judgement. After each eval run, the owner
reads one or more of the plans in `evals/results/` and scores them on the same 1-to-5 criteria (rounds, skills,
budget, design brief, rationale), without looking at the judge's scores first. Record both here. If the judge is
often more than one point away from the owner, change the judge prompt (`apps/worker/src/eval-planner.ts`) or the
pass bar, and run the eval again.

| Date | Fixture | Prompt hash (first 12) | Judge average | Owner average | Note |
| ---- | ------- | ---------------------- | ------------- | ------------- | ---- |
