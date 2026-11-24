# Proposal: Phase 4 build rounds run locally until go-live

- **Status:** accepted
- **Date:** 2026-11-20
- **Raised by:** agent (start of Phase 4)
- **Task or spec reference:** P4-T01 to P4-T13; `docs/spec/07-build-rounds.md`, `docs/spec/06-agents-skills-tools.md`, `docs/spec/12-security.md`

## Problem

Phase 4 as written opens a pull request per round into the client repository's `staging` branch on GitHub, with a short-lived GitHub App token, and shows a Vercel preview. Phase 3 kept the prototype local and moved GitHub and Vercel to go-live item G33 (D-328). Rounds need the same choice, and the phase needs an order.

## Proposed change

1. **Local rounds (D-332).** Each round works on a `round-N` branch in the project's local git repository (`<work dir>/<project>/site`, the one the prototype created), branched from `staging`. There is no pull request: `rounds.branch` is recorded and `pr_number` and `pr_url` stay empty until G33. Before the round goes to review, the build, lint, typecheck and content schema checks must pass on the branch. The owner reviews the round in the console: the round summary, the changed files with a diff against `staging`, the `.pipeline/NOTES.md` diff (D-267), screenshots and the local preview. Accept is recorded in the database only (D-279 holds: the console is the only Accept); the worker then merges `round-N` into `staging` with a merge commit (`--no-ff`, every commit kept), checking first whether the merge is already done so a retry repeats nothing (D-277). Feedback gives the owner's notes to the Builder, which pushes a new version on the same branch. Reject leaves the branch unmerged and the round is redone from `staging`. Real pull requests, App tokens and Vercel previews join G33.
2. **Builder (D-333).** The Builder is an Agent SDK run on the owner's Claude Code login, like the Prototype agent (D-328, D-329): Sonnet 5.5 by default (`WORKER_BUILDER_MODEL`), Opus 5.5 for rounds the approved plan flags hard (`WORKER_BUILDER_HARD_MODEL`). Its Bash tool goes through the command allowlist (P4-T02): every command is parsed and allowed, refused (logged to the backlog), or paused (P4-T03); there are no web tools. File tools stay inside the project directory. The host-only limits of D-300 and D-310 and go-live item G19 still apply.
3. **Order (D-334).** P4-T13 reader stage first (the Builder only ever sees its fields), then P4-T02 Builder and allowlist with P4-T03 pauses, P4-T01 rounds, re-plan and gating, P4-T04 round branch, checks and backlog logging, P4-T05 claims, P4-T06 summary, P4-T07 and P4-T08 backlog views, P4-T09 round gate, P4-T10 token bar, closed by P4-T12. Schema changes the tasks need (for example the merge record on `rounds` and the backlog item fields) go in one migration PR after an independent review, with mutation checks.

## Options considered

- For 1: (A, chosen by the owner on 2026-11-20) local rounds until go-live; (B) a GitHub App and a private throwaway repository now.
- For 2: (A) the owner's Claude Code login, as for the Prototype agent; (B) a paid API key, which is money and stays with the owner's go-live choice (G29).

## Impact

A dev-only note in spec 07 (separate spec-only PR); the P4-T02, P4-T04, P4-T09 and P4-T12 plan lines; go-live item G33 gains round pull requests; `DECISIONS.md` D-332 to D-334.

## Owner decision

Accepted: point 1 is the owner's answer in chat on 2026-11-20 ("Local, like Phase 3"); points 2 and 3 are decided under D-321.
