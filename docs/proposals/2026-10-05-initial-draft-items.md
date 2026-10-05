# Proposal: Items the initial draft decided without a spec answer

- **Status:** open
- **Date:** 2026-10-05
- **Raised by:** drafter of this repo
- **Task or spec reference:** P1-T02, `supabase/migrations/0001_init.sql`, `AGENTS.md`

## Problem

The spec lists field names but not types, and does not cover some repo-level choices. The initial draft made the choices below so the files could be written. Each needs the owner's decision.

## Items

| # | Item | Draft choice | Owner decision |
| --- | --- | --- | --- |
| 1 | Stage value for build rounds | Spec says `build_round_n`; draft uses one repeating stage `build_rounds` with the round number in `rounds.number` (also in `stages.yaml`) | accepted 2026-10-05 (D-038) |
| 2 | `artifacts.client_visible` | Extra column so clients see only the PRD and prototype, never internal plans | pending |
| 3 | How the owner is identified in RLS | JWT `app_metadata.role = 'owner'`, set only by a service-role script | pending |
| 4 | `intake_templates.status` values | `draft`, `approved`, `archived` | pending |
| 5 | `change_requests.decision` values | `accept_current_round`, `defer`, `decline` (from the spec's three outcomes) | pending |
| 6 | Free-text status columns | `rounds.status`, `backlog_items.status`, `stage_runs.status` and `clients.role` are plain text because the spec lists no values | pending |
| 7 | `advance_stage()` | Ships as a stub that raises; implemented in task P1-T07 | pending |
| 8 | Master starter location | A folder in this repo or its own repo (needed in phase 3, task P3-T02) | accepted 2026-10-05: `templates/master-starter/` (D-039) |
| 9 | Dependency rule in `AGENTS.md` | Dependencies named in a task are pre-approved for that task; everything else needs the owner | pending |
| 10 | Tooling defaults | Node `>=20`, TypeScript strict with `noUncheckedIndexedAccess`, Prettier (single quotes, width 100) | pending |
| 11 | License | No license file added | pending |

## Impact

Items 1-7 affect the data model and shared types. Items 8-11 affect plan tasks and repo files. Items 2-7 are reviewed in P1-T02.

## Owner decision

(Left blank for the owner.)
