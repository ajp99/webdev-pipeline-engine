# Build plan

Five phases, built in order. Each phase is closed by one gate that only the owner can accept. Agents work on the first phase whose status is not `done` (see `AGENTS.md`).

| Phase | Name | Gate | Status |
| --- | --- | --- | --- |
| 1 | [Foundation](phase-1-foundation.md) | Migrations applied to a real local Supabase, checks pass, an approved dummy artifact moves a project stage | done |
| 2a | [Intake and runner](phase-2-intake-and-prd.md) | A fictional client's intake, entered by the owner, runs through the real stage runner and intake agent to an accepted intake | not started |
| 2b | [PRD and client review](phase-2-intake-and-prd.md) | The owner records a fictional client's sign-off of a PRD | not started |
| 3 | [Plan and prototype](phase-3-plan-and-prototype.md) | Prototype approved from screenshots | not started |
| 4 | [Build rounds](phase-4-build-rounds.md) | A full round runs with its backlog triaged | not started |
| 5 | [QC, report, handover](phase-5-qc-report-handover.md) | A pilot site is handed over | not started |

Task IDs look like `P2-T04` (phase 2, task 4). A task marked `[-]` is moved to go-live and listed in [go-live-readiness.md](go-live-readiness.md), or dropped by a decision; it is not pending in its phase. Tasks and acceptance criteria were drafted from the spec and the decisions in `DECISIONS.md`, and are open to the owner's edits.

## After the pilot (not scheduled)

- **Skill promotion pipeline:** match detection across projects, `generalize_skill`, diff review, deprecation proposals. It needs marks from at least two projects, so it starts after the pilot. Spec: `docs/spec/06-agents-skills-tools.md`.
- **Orchestration revisit:** triggers are listed in `docs/spec/14-risks-and-out-of-scope.md`.

## Open items for the owner

- **CI** starts in Phase 1 (task P1-T12, D-287). Branch protection stays the owner's call. Until the workflow is merged and green, an agent's report that tests pass is unverified.
- **Pipeline email account:** none during the dev-only period; the owner sees ready gates and failed runs in the console (D-314). The Gmail app password for client and owner emails and Supabase's custom SMTP (tasks P2-T11 and P2-T12) is go-live item G2.
- **Hosting and go-live:** development is dev-only on a local Supabase (D-263). Hosting, plans, client email and the other deferred items are in [go-live-readiness.md](go-live-readiness.md), a Phase 5 gate item (D-296).
- Proposals `2026-10-08-phase-1-spec-alignment.md`, `2026-10-09-pr6-review-changes.md` and `2026-10-13-questionnaire-answers.md` are accepted and applied to the spec (PR #8) and `DECISIONS.md` (D-229 to D-248). Proposal `2026-10-15-review-panel-decisions.md` is accepted; its decisions are D-263 to D-296 and its spec edits are applied in the spec-only PR that follows. The agent asks at the start and end of each phase whether to apply any open proposals.
