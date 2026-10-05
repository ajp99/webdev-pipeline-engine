# webdev-pipeline-engine

CreatePipeline Engine: an internal, single-owner pipeline that takes marketing-site clients from intake to handover. Agents do the work; the owner approves every step through soft, hard, and client gates.

**Status:** specification locked (snapshot of 2026-10-05); empty scaffold; no application code yet. Next: phase 1 in [docs/plan/README.md](docs/plan/README.md).

## Where things are

| Path | Contents |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Instructions for AI agents (start here if you are one) |
| [docs/spec/](docs/spec/README.md) | Locked spec, split by topic, with machine-readable stages and gates |
| [docs/plan/](docs/plan/README.md) | Five build phases with tasks, acceptance criteria and gates |
| [docs/proposals/](docs/proposals/README.md) | Proposed spec changes awaiting the owner |
| [DECISIONS.md](DECISIONS.md) | Decision log |
| [supabase/migrations/](supabase/migrations) | Draft data model with row-level security |
| [skills/](skills/README.md) | Reusable SKILL.md library |
| [templates/master-starter/](templates/master-starter/README.md) | Master site starter (empty until phase 3) |
| `apps/web`, `apps/worker`, `packages/shared` | pnpm workspace packages (empty scaffolds) |

## Notes

- This repo is public by the owner's choice. It must never contain secrets or client data.
- The repo is the source of truth. The original Claude Doc "CreatePipeline Engine: Locked Spec" is a frozen snapshot.
