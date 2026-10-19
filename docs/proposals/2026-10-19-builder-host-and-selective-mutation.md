# Proposal: Builder on the host until go-live; mutation runs by changed rule

- **Status:** accepted (2026-10-19)
- **Date:** 2026-10-19
- **Raised by:** Claude Code, from the owner's question "can we keep docker and mutation for go live?"
- **Task or spec reference:** D-266, D-300, D-288, D-306; spec 00, 02, 12, 14, 15; P2-T04, P2-T23, P4-T02, G19

## Problem

D-300 keeps the Builder in a container while the other agents run on the host. With fictional clients only, the container adds work (an image, mounts, a scrubbed environment, network rules) before there is anything to protect. Docker is still needed for the local Supabase. The full mutation run after every change is slow for a one-person workflow, though dropping it would leave the safety rules untested.

## Proposed change

1. Until go-live every agent, the Builder included, runs on the host in a per-project working directory with an open network (D-310). The Builder container and the isolation of all agents are go-live item G19.
2. Rule 5 stays. A local run executes only the mutation files for the rules a change touches; the full suite runs in CI on every pull request that touches `supabase/**` and at each phase gate (D-311).
3. One-time exception to rule 1: P2-T17 and P2-T01, which change no migration, may start before the Phase 1 gate (D-312).

Spec edits (exactly these lines, wording only about where the Builder runs): `00-overview.md` trust zones row and Builder row; `02-architecture.md` the workers node; `12-security.md` worker isolation and builder commands; `14-risks-and-out-of-scope.md` the install-scripts risk; `15-operations.md` the walking skeleton, containers and trust zones, and the lockfile paragraph. Plan edits: P2-T04, P2-T23, P4-T02, G19. `AGENTS.md` and `supabase/tests/README.md` describe the selective mutation run.

Alignment edits added at the owner's request ("Fix doc drifts, inconsistency and any mismatch also", 2026-10-19), each only restating an accepted decision (D-297 to D-305): `10-data-model.md` (claim function skips `cancel_requested` too; `retention_*` and `client_visible` marked go-live), `12-security.md` (dev-only banner; a waiting run keeps its slot until answered, parking is G16), `14-risks-and-out-of-scope.md` and `15-operations.md` (same waiting-run wording; the unique index covers `cancel_requested`).

## Options considered

- Option A: as above (the owner's choice).
- Option B: keep the Builder container in Phase 2a (D-300 unchanged). Rejected by the owner.
- Option C: keep the container from Phase 4. Not chosen.

## Impact

No migration or test change. Install scripts of client-site dependencies run on the owner's machine until go-live, which is acceptable only while every client is fictional. 

## Owner decision

The owner chose "host, container at go-live", "changed rules locally, full in CI" and "process PR first, then non-migration 2a work" in chat on 2026-10-19, and chose to put the spec edits in the process PR as a one-time exception to rule 2 (as for #21).
