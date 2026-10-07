# Phase 3: Plan and prototype

**Status:** not started

**Goal:** The skills library, the master starter, the Planner, the provisioning script, the eval harness, and one prototype design shown to the client as screenshots, with owner and client approval.

**Gate (owner accepts this phase when):** Prototype approved from screenshots.

**Spec to read:** [06-agents-skills-tools.md](../spec/06-agents-skills-tools.md), [03-pipeline-and-gates.md](../spec/03-pipeline-and-gates.md), [02-architecture.md](../spec/02-architecture.md), [09-deployment-and-handover.md](../spec/09-deployment-and-handover.md)

Rules: work only on this phase's tasks; tick each box when its acceptance criteria are met and add an entry to [PROGRESS.md](PROGRESS.md). Ask the owner before schema changes or dependencies not named in a task. Spec files are read-only; propose changes in `docs/proposals/`.

## Tasks

- [ ] **P3-T01 Skills library structure and registry sync**  
  Acceptance: `skills/` folders and a documented SKILL.md format. An agent drafts the first skills for the areas in `skills/README.md` from the starter and spec, and the owner reviews them. A script scans `skills/` and updates `skills_registry`, at worker start and before each run. The Planner selects skills per project and the worker loads only those into the run.

- [ ] **P3-T02 Master starter**  
  Acceptance: One master Next.js + Tailwind starter in `templates/master-starter/` with: a library of section components (hero, features, testimonials, FAQ, call to action, contact); MDX for pages and posts and JSON for settings and navigation, with schema checks at build that give plain-language errors; a blog; a Resend contact form route with the spam protection chosen per project; privacy policy and cookie notice templates; SEO basics; a `<Claim>` marker component that renders normally; placeholder images with descriptive alt text, clearly marked. Lighthouse 80+ on the starter.

- [ ] **P3-T03 Planner agent**  
  Acceptance: Produces the plan artifact: structured fields (rounds with scope, skills, dependencies, token budget) plus a markdown rationale per section, edited as text by the owner. Proposes the round count by the rule of thumb (5 pages or fewer and no blog is 2 rounds, otherwise 4; the owner can override), flags hard rounds for Opus 5.5, and proposes the token budget; the owner confirms these when approving the plan (soft gate).

- [ ] **P3-T04 Prototype agent**  
  Acceptance: Builds one design of the main page from the plan, the intake design section, the brand inputs and the starter, with real copy drafted from the intake (every factual claim in a `<Claim>` marker). Pushes it to the `staging` branch with a short-lived GitHub App token. The worker builds the site and serves it locally, then takes full-page desktop and mobile screenshots with Playwright (the owner installs the browser on their machine). No agent self-check; no live preview goes to the client.

- [ ] **P3-T05 Two-step prototype approval**  
  Acceptance: The owner approves first (soft gate), after reviewing the screenshots and the live preview in Vercel while logged in. The client then sees the screenshots only and can Approve, or Request changes with a required note (client gate). Two approval records.

- [ ] **P3-T06 Prototype feedback**  
  Acceptance: One free-text feedback box per revision, stored as a prototype note. Notes reach the owner as raw text with the actions forward to the agent, convert to a change request, or dismiss.

- [ ] **P3-T07 Revision cap**  
  Acceptance: At most 2 revision cycles. A cycle starts each time the owner sends feedback to the agent for a new prototype version; the first version does not count. After that, further changes need the owner's decision.

- [ ] **P3-T08 Skill use marks**  
  Acceptance: At stage approval the owner can optionally mark each skill used as good or bad; marks are stored in `skill_uses`; unmarked uses do not count.

- [ ] **P3-T09 Project provisioning script (owner-run)**  
  Acceptance: One command, run by the owner, creates the client repo from `templates/master-starter`, installs the GitHub App on it, creates and links the Vercel project (production branch `main`, previews from `staging`; Vercel's login protection stays on), and records `github_repo` and `vercel_project_id`. Each step checks whether it is already done, so a rerun resumes; a cleanup command removes a half-created project after a confirmation; a dry-run mode shows the planned steps first. Workers never receive broader credentials.

- [ ] **P3-T10 Eval harness**  
  Acceptance: Fictional client fixtures live in `evals/fixtures/`: a dental clinic, a law firm and a restaurant. A harness runs the Planner (skill selection and round plan) against them and scores the results with an Opus 5.5 judge. It runs when prompts or models change, and its scores are calibrated against the owner's spot checks. Fixtures contain no real client data.

- [ ] **P3-T11 Phase 3 gate evidence**  
  Acceptance: Record in `PROGRESS.md`: a manual walkthrough from a signed PRD to an approved prototype with the owner as the test client from a second email; an automated end-to-end test of the same flow with model responses stubbed; a cost report in tokens from `stage_runs`; and the Planner eval results on the 3 fixtures.

## Gate

The phase is done when: **Prototype approved from screenshots**. Only the owner marks it done, by setting **Status** above to `done` and updating `docs/plan/README.md`.
