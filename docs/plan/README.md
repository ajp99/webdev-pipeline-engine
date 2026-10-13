# Build plan

Five phases, built in order. Each phase is closed by one gate that only the owner can accept. Agents work on the first phase whose status is not `done` (see `AGENTS.md`).

| Phase | Name | Gate | Status |
| --- | --- | --- | --- |
| 1 | [Foundation](phase-1-foundation.md) | An approved dummy artifact moves a project stage | in progress |
| 2a | [Intake and runner](phase-2-intake-and-prd.md) | A test client's intake runs through the real stage runner and intake agent to an accepted intake | not started |
| 2b | [PRD and client review](phase-2-intake-and-prd.md) | A test client signs off a PRD | not started |
| 3 | [Plan and prototype](phase-3-plan-and-prototype.md) | Prototype approved from screenshots | not started |
| 4 | [Build rounds](phase-4-build-rounds.md) | A full round runs with its backlog triaged | not started |
| 5 | [QC, report, handover](phase-5-qc-report-handover.md) | A pilot site is handed over | not started |

Task IDs look like `P2-T04` (phase 2, task 4). Tasks and acceptance criteria were drafted from the spec and the decisions in `DECISIONS.md`, and are open to the owner's edits.

## After the pilot (not scheduled)

- **Skill promotion pipeline:** match detection across projects, `generalize_skill`, diff review, deprecation proposals. It needs marks from at least two projects, so it starts after the pilot. Spec: `docs/spec/06-agents-skills-tools.md`.
- **Orchestration revisit:** triggers are listed in `docs/spec/14-risks-and-out-of-scope.md`.

## Open items for the owner

- **CI** starts with Phase 2 (task P2-T17, draft D-240). Branch protection stays the owner's call. Until CI exists, an agent's report that tests pass is unverified.
- **Pipeline email account:** the owner supplies a Gmail app password (needs 2-step verification on the Google account) for the pipeline's client and owner emails and for Supabase's custom SMTP (tasks P2-T11 and P2-T12).
- Open proposals: `docs/proposals/2026-10-08-phase-1-spec-alignment.md`, `2026-10-09-pr6-review-changes.md` and `2026-10-13-questionnaire-answers.md`. The agent asks at the start and end of each phase whether to apply them.
