# Spec index

> Originally a snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05). The repo is the source of truth; this file reflects the owner-approved decisions recorded in `DECISIONS.md`. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

| File | Covers |
| --- | --- |
| [00-overview.md](00-overview.md) | Summary and locked decisions |
| [01-actors.md](01-actors.md) | Client, owner, agent system |
| [02-architecture.md](02-architecture.md) | Architecture, stack, stage runner interface |
| [03-pipeline-and-gates.md](03-pipeline-and-gates.md) | Eight stages, gate types, loops and limits |
| [04-intake.md](04-intake.md) | Intake system |
| [05-requirements-and-change-control.md](05-requirements-and-change-control.md) | PRD, lock flow, change requests |
| [06-agents-skills-tools.md](06-agents-skills-tools.md) | Agents, skills library, promotion lifecycle, copy rules |
| [07-build-rounds.md](07-build-rounds.md) | Build rounds and question backlog |
| [08-qc-and-report.md](08-qc-and-report.md) | QC checks and final report |
| [09-deployment-and-handover.md](09-deployment-and-handover.md) | Deployment, handover, project close |
| [10-data-model.md](10-data-model.md) | Tables and stages (SQL in `supabase/migrations/`) |
| [11-owner-console-and-client-dashboard.md](11-owner-console-and-client-dashboard.md) | Owner console and client dashboard |
| [12-security.md](12-security.md) | Security and credentials |
| [13-cost.md](13-cost.md) | Cost estimate |
| [14-risks-and-out-of-scope.md](14-risks-and-out-of-scope.md) | Assumptions, risks, revisit triggers, out of scope |
| [15-operations.md](15-operations.md) | Project setup, backups, evals, pilot, notifications, MCP server |
| [stages.yaml](stages.yaml) | Machine-readable stage definitions |
| [gates.yaml](gates.yaml) | Machine-readable gate types, classification, defaults |

Decisions and their history: [../../DECISIONS.md](../../DECISIONS.md). Build plan: [../plan/README.md](../plan/README.md).
