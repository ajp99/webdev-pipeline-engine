# Proposal: Phase 3 runs locally until go-live

- **Status:** accepted
- **Date:** 2026-11-20
- **Raised by:** agent (start of Phase 3)
- **Task or spec reference:** P3-T04, P3-T05, P3-T09, P3-T10; `docs/spec/03-pipeline-and-gates.md`, `docs/spec/06-agents-skills-tools.md`, `docs/spec/09-deployment-and-handover.md`

## Problem

Phase 3 as written needs a GitHub App (the Prototype agent pushes to the client repo's `staging` branch with a short-lived App token), a Vercel account (the owner reviews the live preview there, and P3-T09 creates the Vercel project), and a paid Anthropic API key (P3-T10's Opus 5.5 judge). The project is dev-only until go-live (D-263): there is no hosted project and no real client, and accounts and money are the owner's decision (D-321).

## Proposed change

1. **Local prototype (D-328).** The Prototype agent works like the Builder (D-310): an Agent SDK run on the owner's machine with the owner's Claude Code login, in the project's working directory, on a local git repository created from `templates/master-starter`, committing to a `staging` branch. The worker builds the site, serves it locally, and takes full-page desktop and mobile screenshots with Playwright. The owner reviews the screenshots and the local preview (instead of the Vercel preview) before the soft gate. No GitHub token or Vercel token is used.
2. **Provisioning script in dry-run (D-328).** P3-T09 is built with its steps (create repo, install the GitHub App, create and link the Vercel project, record `github_repo` and `vercel_project_id`), the resume check per step, the cleanup command with confirmation, and the dry-run mode, all tested against fake GitHub and Vercel clients. Running it against real accounts moves to go-live item G33, together with the Prototype agent's push to GitHub.
3. **Eval judge (D-329).** The eval harness's judge runs on the owner's Claude Code login through the Agent SDK (model pinned to Opus 5.5), with no API key. The paid-API judge moves to go-live with G29.
4. **Phase 3 order (D-330).** P3-T10 fixtures and checks first (D-244), then P3-T01 skills, P3-T02 master starter, P3-T12 reference screenshots, P3-T03 Planner, P3-T10 harness and judge, P3-T04 Prototype agent, P3-T05 to P3-T07 approvals, feedback and the revision cap, P3-T08 skill marks, P3-T09 provisioning (dry-run), closed by P3-T11.

## Options considered

- For 1 and 2: (A, chosen by the owner on 2026-11-20) local until go-live; (B) a GitHub App and a Vercel Hobby account now.
- For 3: (A, chosen by the owner) the Claude Code login; (B) Gemini as the judge; (C) a paid API key.

## Impact

Dev-only notes in spec 03, 06 and 09; the P3-T04, P3-T05, P3-T09 and P3-T10 plan lines; go-live item G33; `DECISIONS.md` D-328 to D-330.

## Owner decision

Accepted: points 1 to 3 are the owner's answers in chat on 2026-11-20 ("Keep it local; real accounts at go-live", "Your Claude Code login via the Agent SDK"); point 4 is decided under D-321.
