# Proposal: Items the initial draft decided without a spec answer

- **Status:** accepted (2026-10-05)
- **Date:** 2026-10-05
- **Raised by:** drafter of this repo
- **Task or spec reference:** `supabase/migrations/0001_init.sql`, `AGENTS.md`

## Problem

The spec lists field names but not types, and does not cover some repo-level choices. The initial draft made the choices below so the files could be written. The owner decided each one.

## Items and decisions

| # | Item | Draft choice | Owner decision |
| --- | --- | --- | --- |
| 1 | Stage value for build rounds | One repeating stage `build_rounds` | accepted (D-038) |
| 2 | `artifacts.client_visible` | Extra column so clients see only the PRD and prototype | accepted (D-063) |
| 3 | How the owner is identified in RLS | JWT claim | changed: an `owners` table (D-040) |
| 4 | `intake_templates.status` values | `draft`, `approved`, `archived` | accepted; the template is copied into the project instead of being read by clients (D-061) |
| 5 | `change_requests.decision` values | `accept_current_round`, `defer`, `decline` | accepted (D-063) |
| 6 | Free-text status columns | Plain text | changed: enums for `rounds`, `stage_runs`, `backlog_items`; `clients.role` removed (D-041, D-042) |
| 7 | `advance_stage()` | Ships as a stub until task P1-T07 | accepted (D-063) |
| 8 | Master starter location | Not decided | `templates/master-starter/` (D-039) |
| 9 | Dependency rule in `AGENTS.md` | Named dependencies pre-approved | loosened: standard dev tooling needs no approval (D-044) |
| 10 | Tooling defaults | Node `>=20` | changed: Node 22 or newer with `.nvmrc` (D-048) |
| 11 | License | None added | no license file (D-043) |

## Owner decision

Accepted as recorded above. Further decisions are in `DECISIONS.md` (D-040 to D-069).
