# Evals

Automated checks of agent quality, so a prompt or model change cannot quietly make results worse.

- `fixtures/` holds **fictional** clients (intake answers across a few industries). Never put real client data here: this repo is public.
- A harness (task P3-T10) runs an agent against the fixtures and scores the result with a judge model (Opus 5.5). It runs when prompts or models change, not on every commit.
- The Planner (skill selection and round plan) is evaluated first. Other agents follow.
- Calibrate the judge against the owner's own spot checks.

See `docs/spec/15-operations.md`.
