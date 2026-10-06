# Phase 3: Plan and prototype

**Status:** not started

**Goal:** Skills library, the master starter, the Planner, and the single-page prototype with owner and client approval.

**Gate (owner accepts this phase when):** Prototype approved from a live preview.

**Spec to read:** [06-agents-skills-tools.md](../spec/06-agents-skills-tools.md), [03-pipeline-and-gates.md](../spec/03-pipeline-and-gates.md), [02-architecture.md](../spec/02-architecture.md), [09-deployment-and-handover.md](../spec/09-deployment-and-handover.md)

Rules: work only on this phase's tasks; tick each box when its acceptance criteria are met and add an entry to [PROGRESS.md](PROGRESS.md). Ask the owner before schema changes or dependencies not named in a task. Spec files are read-only; propose changes in `docs/proposals/`.

## Tasks

- [ ] **P3-T01 Skills library structure and registry sync**  
  Acceptance: `skills/` folders and a documented SKILL.md format; `skills_registry` stays in sync with the folder; a first set of starter skills exists for the areas in `skills/README.md`.

- [ ] **P3-T02 Master starter**  
  Acceptance: One master Next.js + Tailwind starter with MDX/JSON content, blog, a Resend contact form route, privacy policy and cookie notice templates, SEO basics. It lives in `templates/master-starter/`, outside the pnpm workspaces. Lighthouse 80+ on the starter.

- [ ] **P3-T03 Planner agent**  
  Acceptance: Produces the plan artifact: skills and tools chosen, build plan, and the proposed round count and scope per round from the locked PRD; owner edits and approves (soft gate).

- [ ] **P3-T04 Prototype agent**  
  Acceptance: Builds the single main page from the plan, brand inputs and starter into the project repo and pushes it to the `staging` branch with a short-lived GitHub App token. The preview URL is read from the GitHub deployment status that Vercel's Git integration posts. No Vercel token is used.

- [ ] **P3-T05 Two-step prototype approval**  
  Acceptance: Owner approves first (soft), then the client approves (client gate) from the dashboard; two approval records; the client preview link is visible only to that project's logins.

- [ ] **P3-T06 Prototype comments**  
  Acceptance: Clients comment on the prototype only while the stage is prototype; comments reach the owner as raw text with forward-to-agent, convert-to-change-request, and dismiss actions.

- [ ] **P3-T07 Revision cap**  
  Acceptance: At most 2 prototype revision cycles are tracked; after that further changes need the owner's decision.

- [ ] **P3-T08 Skill use marks**  
  Acceptance: At stage approval the owner can optionally mark each skill used as good or bad; marks are stored in `skill_uses`; unmarked uses do not count.

- [ ] **P3-T09 Project provisioning script (owner-run)**  
  Acceptance: One command, run by the owner, creates the client repo from `templates/master-starter`, installs the GitHub App on it, creates and links the Vercel project (production branch `main`, previews from `staging`), and records `github_repo` and `vercel_project_id` in `projects`. Workers never receive broader credentials.

- [ ] **P3-T10 Eval harness**  
  Acceptance: Fictional client fixtures live in `evals/fixtures/`. A harness runs the Planner (skill selection and round plan) against them and scores the results with an Opus 5.5 judge. It runs when prompts or models change, and its scores are calibrated against the owner's spot checks. Fixtures contain no real client data.

## Gate

The phase is done when: **Prototype approved from a live preview**. Only the owner marks it done, by setting **Status** above to `done` and updating `docs/plan/README.md`.
