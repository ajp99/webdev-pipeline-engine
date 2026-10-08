# Build plan

Five phases, built in order. Each phase is closed by one gate that only the owner can accept. Agents work on the first phase whose status is not `done` (see `AGENTS.md`).

| Phase | Name | Gate | Status |
| --- | --- | --- | --- |
| 1 | [Foundation](phase-1-foundation.md) | An approved dummy artifact moves a project stage | not started |
| 2 | [Intake and PRD](phase-2-intake-and-prd.md) | A test client signs off a PRD | not started |
| 3 | [Plan and prototype](phase-3-plan-and-prototype.md) | Prototype approved from screenshots | not started |
| 4 | [Build rounds](phase-4-build-rounds.md) | A full round runs with its backlog triaged | not started |
| 5 | [QC, report, handover](phase-5-qc-report-handover.md) | A pilot site is handed over | not started |

Task IDs look like `P2-T04` (phase 2, task 4). Tasks and acceptance criteria were drafted from the spec and the decisions in `DECISIONS.md`, and are open to the owner's edits.

## After the pilot (not scheduled)

- **Skill promotion pipeline:** match detection across projects, `generalize_skill`, diff review, deprecation proposals. It needs marks from at least two projects, so it starts after the pilot. Spec: `docs/spec/06-agents-skills-tools.md`.
- **Orchestration revisit:** triggers are listed in `docs/spec/14-risks-and-out-of-scope.md`.

## Open items for the owner

- **CI and branch protection** are deferred (D-046). Until CI exists, an agent's report that tests pass is unverified. The owner decides when to add them.
- **Pipeline email account:** the owner supplies a Gmail app password for the pipeline's client and owner emails and for Supabase's custom SMTP (tasks P2-T11 and P2-T12).
- No unresolved spec items remain; see `docs/proposals/` for how earlier ones were decided.
