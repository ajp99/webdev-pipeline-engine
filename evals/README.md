# Evals

Automated checks of agent quality, so a prompt or model change cannot quietly make results worse.

- `fixtures/` holds **fictional** clients (intake answers across a few industries). Never put real client data here: this repo is public.
- A harness (task P3-T10) runs an agent against the fixtures and scores the result with a judge model (Opus 5.5). It runs when prompts or models change, not on every commit.
- The Planner (skill selection and round plan) is evaluated first, on 3 fictional clients: a dental clinic, a law firm and a restaurant. Other agents follow.
- Calibrate the judge against the owner's own spot checks.

See `docs/spec/15-operations.md`.

## Planner fixtures (P3-T10, written before the Planner, D-244)

- `fixtures/planner/` holds three fictional clients: `dental-clinic` (4 pages, a form, 2 rounds), `law-firm` (7 pages and a blog, 4 rounds) and `restaurant` (5 pages, no form, 2 rounds). Each has the Planner's input (a PRD in the stored shape and the intake's design answers) and what a plan must do.
- The deterministic checks are in `packages/shared/src/plan-eval.ts`: the plan shape (`plan.ts`), the rule-of-thumb round count (D-126), every page in some round's scope, the expected skill areas selected and no needless ones, a design brief that uses the intake's design answers, no trace of injected instructions (D-267: the law firm and the restaurant carry one each), and dependencies on earlier rounds only. `plan.test.ts` proves each check by a plan that breaks it.
- The judge (Opus 5.5 on the owner's Claude Code login, D-329) scores what these checks cannot: whether the rounds are sensible, the skills fit, the budget is plausible, the design brief follows the intake and the rationale is clear (1 to 5 each).

## Running the Planner eval

`pnpm --filter @wpe/worker eval:planner` runs the Planner (the model in `apps/worker/.env`) on every fixture, applies the deterministic checks, and asks the judge for scores. A fixture passes when every check passes and the judge's average is at least 3.5. The full report goes to `evals/results/` (not committed); the record `evals/last-run/planner.json` (prompt hash, models, averages) is committed, and a test fails when the Planner's prompt changes without a new run (D-283). Record your own spot checks in `calibration.md`.

