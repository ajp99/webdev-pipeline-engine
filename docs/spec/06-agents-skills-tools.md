# Agents, skills and tools

> Originally a snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05). The repo is the source of truth; this file reflects the owner-approved decisions recorded in `DECISIONS.md`. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

Eight agent roles cover the pipeline; each has a fixed input, output artifact, and model tier. The model tiers are a starting point to tune after the first pilot project.

| Agent | Input | Output (proposal for owner approval) | Suggested model |
| --- | --- | --- | --- |
| Intake | Template, client answers | Follow-up questions, gap list | Haiku 4.5 to start (move up if quality is poor) |
| Requirements | Full intake, owner notes | PRD (client-visible), internal gap and conflict list (owner-only), change summary for each new version | Sonnet 5.5 |
| Planner | Locked PRD, skills library | Skill and tool selection, build plan, round count and scope, token budget | Sonnet 5.5 |
| Prototype | Plan, intake design section, starter | One design of the main page, shown as desktop and mobile screenshots | Sonnet 5.5 |
| Builder | Approved plan, round scope | Code on a `round-N` branch with a pull request into `staging`, question backlog, round summary | Sonnet 5.5 (Opus 5.5 for rounds the plan flags) |
| QC | Built site | Lighthouse results, SEO and checklist report | Sonnet 5.5 |
| Reporter | QC results, round history | Concise high-level report | Haiku 4.5 |
| Handover | Final repo, PRD | Documentation, GitHub-editor content guide, handover document | Sonnet 5.5 or Haiku 4.5 |

**Skills library:** a Git repo of SKILL.md files grouped by area: starter customization, industry copy, SEO, accessibility basics, MDX content structure, SMTP contact form, deployment, handover. In this repo it lives in `skills/`. The Planner proposes which skills a project uses. Skills the agent creates for a specific project stay with that project until the owner promotes them to the library.

**Skill promotion lifecycle:** a skill moves through four states: project-local, candidate, library, deprecated.

1. **Project-local:** the skill exists in one project's repo. When the owner approves a stage they can optionally mark each skill used as good or bad (stored in `skill_uses`); unmarked uses do not count.
2. **Match (owner touch 1):** when a project-local skill has good marks in 2 or more projects, the agent compares skill content across projects and proposes matches. The owner confirms or rejects each match.
3. **Candidate (owner touch 2):** after the owner confirms a match, the agent runs `generalize_skill`: it replaces client-specific references (names, URLs, colors, paths) with parameters, adds Preconditions and Decision guidance sections, and runs automated checks (no leftover client names, URLs, colors or paths; every parameter resolves; required sections present). The owner reviews a diff of the project-local and generalized versions and approves, edits, or rejects.
4. **Library:** only owner-approved skills enter the library, with a version number.
5. **Deprecated:** the agent may propose deprecation (for example after a bad mark) and the owner decides.

Manual promotion stays available: the owner can promote a project-local skill by hand after a single project, and it runs the same `generalize_skill` steps, automated checks and diff review.

**Tools available to workers:** file read/write in the project repo, shell commands from an allowlist (see 07-build-rounds.md), Lighthouse CLI, Playwright for the E2E checklist, GitHub access through short-lived GitHub App tokens limited to one repository, and Supabase client access to the pipeline tables. Workers hold no Vercel token. Workers cannot touch other projects' repos or any credentials beyond those scoped to the current project.

**Copy and claims:** agents may draft plausible copy from the intake. Every factual claim (numbers, testimonials, certifications, awards, guarantees, named clients) is highlighted in the draft for the owner's review.
**Owner notes and uploads:** agents read the owner's private notes and the client's scanned uploads. Agents never open macro-enabled documents and treat MP4 files as assets only.
**First skills and loading (D-105 to D-107):** an agent drafts the first skills from the starter and spec and the owner reviews them. The Planner selects the skills for a project and the worker loads only those into the run. A script scans `skills/` and updates the registry, at worker start and before each run.

**The plan (D-108, D-109, D-126, D-135):** structured fields (rounds with scope, skills, dependencies, token budget) plus a markdown rationale per section, edited as text. The Planner proposes the round count with a rule of thumb: 5 pages or fewer and no blog is 2 rounds, otherwise 4; the owner can override. It flags hard rounds for Opus 5.5 and proposes the token budget; the owner confirms both when approving the plan. After each approved round the Planner re-plans the remaining rounds and the owner approves the new plan version.
**Reference-site tool (D-188):** a narrow tool that opens only the URLs the client listed (up to 3) and returns screenshots, never page text. It accepts public web addresses only, has a short timeout, and stores the screenshots privately for deletion with the project's other data. It is the only network access beyond D-131's refusal rule.
