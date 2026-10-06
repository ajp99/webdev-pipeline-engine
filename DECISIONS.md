# Decision log

Every locked decision, with its area and reason. Source of the spec decisions: the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05) and the review sessions that produced it. Where no reason was recorded, the entry says "Owner's choice". New decisions are appended; superseded ones stay with a note.

| ID | Area | Decision | Reason |
| --- | --- | --- | --- |
| D-001 | Scope | Internal tool for one owner (freelance/agency pipeline); not multi-tenant | Owner's choice |
| D-002 | Scope | Marketing sites and landing pages only | Owner's choice |
| D-003 | Autonomy | Human-in-the-loop: owner approves every stage | Owner's choice |
| D-004 | Orchestration | Agent SDK workers plus Supabase state behind a swappable stage runner interface | Workers run on the owner's machine and approvals live in the database; a workflow engine (Inngest, Trigger.dev) can replace the runner later; the wake-up mechanism is superseded by D-050 |
| D-005 | Worker host | Owner's own machine; must be online while a stage runs | Free; accepted trade-off |
| D-006 | Intake | Hybrid: industry templates plus agent follow-ups; cap of 3 follow-up rounds | Owner's choice. A coverage-score model was considered and dropped |
| D-007 | Intake | Agent generates industry templates; owner edits and approves; they join the template library | Owner's choice |
| D-008 | Client assets | Optional uploads; agent structures and generates copy | Owner's choice |
| D-009 | Client access | Email + password accounts; several logins per project, any can approve; approvals only in the dashboard | Owner's choice |
| D-010 | Client dashboard | Intake, progress tracker, PRD sign-off, prototype preview and approval, comments on the prototype only | Owner's clarification: clients can fill intake, view the prototype, comment on the prototype only |
| D-011 | Client comments | Reach the owner first as raw text; owner decides what goes to agents | Owner's choice |
| D-012 | Prototype | Single-page clickable preview of the main page; at most 2 revision cycles | Owner's choice |
| D-013 | Build rounds | Agent proposes round count and scope from pages and features; owner approves (about 2 simple, 4 larger) | Owner's choice |
| D-014 | Gates | Three gate types (soft, hard, client); no auto-advance; overdue gates only show a badge after 24 hours (per-stage, per-project overridable) | Owner's choice; keeps "owner approves every stage" intact |
| D-015 | Gates | Prototype has two approval records (owner soft, then client); PRD lock is one client gate with owner edits part of the stage; QC results and report are one gate | Owner's choice |
| D-016 | Gates | Owner actions: Accept, Feedback (new version), Reject (no new version); hard gates have no extra confirmation | Owner's choice |
| D-017 | Final acceptance | No client approval before go-live; client sees the final site once live; changes until handover complete go through change requests; after close, outside the pipeline | Owner's choice |
| D-018 | Questions | ask-client backlog questions are answered by the client in the dashboard | Owner's choice |
| D-019 | QC | Lighthouse 80+, basic SEO, generic checklist; at most 2 fix loops, then the owner accepts or fixes manually | Owner's choice |
| D-020 | Skills | Library of SKILL.md files in this repo (`skills/`); lifecycle project-local, candidate, library, deprecated; two owner reviews (match, then diff); automated checks only; optional good/bad marks; agent may propose deprecation; manual promotion stays | Owner's choice |
| D-021 | Site architecture | Static-first Next.js, MDX/JSON content, blog, contact form emailed via Resend, no database; spam protection chosen per project | Owner's choice |
| D-022 | Content | Agents may draft plausible copy; every factual claim is highlighted for owner review | Owner's choice |
| D-023 | Legal pages | Every site gets a privacy policy and cookie notice drafted by the agent for owner review | Owner's choice |
| D-024 | Languages | Multi-language sites are out of scope for v1 | Owner's choice |
| D-025 | Commercial | Quotes and price estimates are handled outside the pipeline | Owner's choice |
| D-026 | Hosting | Owner hosts on Vercel first; ownership transferred at handover | Owner's choice |
| D-027 | Handover | Client edits MDX/JSON through the GitHub web editor with a short guide; handover document shared manually by WhatsApp or email and may contain credentials | Owner's choice; credential exposure is an accepted risk |
| D-028 | Project close | Ownership transferred, scoped tokens revoked, read-only archive; uploads and intake data deleted after 90 days (adjustable per project); client accounts stay active until the owner disables them | Owner's choice |
| D-029 | Lifecycle | Paused state; a cancelled project is closed and archived like a finished one | Owner's choice |
| D-030 | Cost control | Per-project warning threshold for token cost; nothing pauses automatically | Owner's choice |
| D-031 | Owner security | Owner login is email + password without multi-factor for now | Owner's choice; accepted risk |
| D-032 | Alerts | Dashboard only (approval queue with badge counts and overdue badges) | Owner's choice |
| D-033 | Repo | pnpm workspaces monorepo (`apps/web`, `apps/worker`, `packages/shared`), no Turborepo | Keeps worker secrets and dependencies out of the web app; shared stage and gate types in one package; Turborepo can be added later |
| D-034 | Repo | Repo stays public; owner accepts the leak risk | Owner's choice |
| D-035 | Repo | The repo is the source of truth; the Claude Doc is a frozen snapshot | Owner's choice |
| D-036 | Repo | Docs: split spec per topic with YAML for stages and gates and SQL for the data model; one plan file per phase; single DECISIONS.md | Owner's choice |
| D-037 | Repo | AGENTS.md as the main agent file with a short CLAUDE.md pointing to it | Works across several coding agents and Claude Code |
| D-038 | Data model | Build rounds are one repeating stage `build_rounds`, with the round number in `rounds.number`. This replaces the spec snapshot's `build_round_n` stage value; the snapshot in `docs/spec/10-data-model.md` is left unchanged | Keeps the stage enum fixed; `stages.yaml` and the SQL already use it |
| D-039 | Repo | The master site starter lives in `templates/master-starter/`, outside the pnpm workspaces | Keeps starter dependencies separate from the pipeline's; stays in one repo |
| D-040 | Security | The owner is recognized by membership in an `owners` table checked by the RLS policies, replacing the JWT claim | Revocable instantly; ready for a second owner |
| D-041 | Data model | `rounds.status`, `stage_runs.status` and `backlog_items.status` are enums (values proposed by the drafter, accepted by the owner) | The database rejects typos and generated types list the states |
| D-042 | Data model | `clients.role` is removed | Roles come from the owners table |
| D-043 | Repo | No license file | Internal tool; all rights reserved by default |
| D-044 | Agents | Standard dev tooling (linters, formatters, test runners, type packages) may be added without asking; application dependencies and schema changes still need approval | Owner's choice |
| D-045 | Notifications | Clients receive emails via Resend for four events (intake follow-ups ready, PRD ready, prototype ready, ask-client question waiting); owner alerts stay dashboard-only | Otherwise a client is never told something is waiting |
| D-046 | Repo | GitHub secret scanning and push protection now; CI and branch protection later | Public repo. Until CI exists, an agent's "tests pass" is unverified |
| D-047 | Data model | Superseded by D-061. Original: keep the client template policy and never archive a template in use | Replaced by the template snapshot |
| D-048 | Tooling | Node 22 or newer, with `.nvmrc` | Node 20 is past end of life as far as known |
| D-049 | Operations | Database exports on a schedule and before each project close | The approval log lives only in Supabase |
| D-050 | Orchestration | The runner polls a durable queue (`stage_runs`) every 15 to 30 seconds and claims work with `FOR UPDATE SKIP LOCKED`, with a heartbeat for crash recovery; supersedes the Realtime wake-up | No lost events when the laptop is offline; approvals are human-paced, so seconds of delay do not matter |
| D-051 | Starter | The starter version is not tracked per client site | Owner's choice |
| D-052 | Config sync | A consistency test checks the YAML against the SQL (stage enum and gate seed); TypeScript types come from the database; gate behavior is read from `gate_config` at runtime | Avoids maintaining a custom code generator |
| D-053 | Security | Workers are isolated by per-project working directory only | Owner's choice; container isolation is the next step if the risk grows |
| D-054 | Client repos | Rounds are built on a `staging` branch; `main`, the Vercel production branch, changes only at deployment preparation | A site cannot go live early |
| D-055 | Roadmap | An MCP server for the owner's chat is added to the roadmap | Owner's choice |
| D-056 | Review | Each build round is a pull request into `staging`; the console Accept merges it, Feedback comments on it, Reject closes it | A ready-made diff and review surface, with previews attached |
| D-057 | Roadmap | The MCP server is read-only (status, approval queue, backlog, cost) and lands at the end of phase 5, before the pilot | Chat must not be able to approve gates; prompt-injection risk |
| D-058 | Approvals | A merge of a round's pull request into `staging` by the owner's GitHub account counts as Accept, via a webhook that is signature-verified and idempotent | Owner's choice |
| D-059 | Security | Workers use a GitHub App: short-lived tokens limited to one client repo, created per run | Scoped tokens without manual per-project creation |
| D-060 | Provisioning | An owner-run script creates each repo, links the Vercel project and records the IDs; workers get GitHub tokens only; Vercel deploys through its Git integration; the owner sets environment variables and domains | Workers never hold broader credentials |
| D-061 | Data model | The template's sections are copied into the project at creation, with the template id kept for reference; clients have no read policy on templates. Supersedes D-047 | The project keeps the version it started with |
| D-062 | Operations | Exports are encrypted, saved locally and copied to the owner's own cloud drive; never into the public repo | Owner's choice |
| D-063 | Data model | Proposal items 2 (`client_visible`), 5 (change decisions) and 7 (`advance_stage` stub) accepted as drafted | Owner's choice |
| D-064 | Pilot | The pilot is the owner's own site, with the owner playing the client from a second email account | Owner's choice |
| D-065 | Evals | Automated eval harness with a judge model from the start, run when prompts or models change | Owner's choice |
| D-066 | Accessibility | Lighthouse 80 only, as in the spec | Owner's choice |
| D-067 | Evals | The Planner (skill selection and round plan) is evaluated first | Owner's choice |
| D-068 | Evals | The judge model is Opus 5.5 | Stronger judge; about double the cost |
| D-069 | Operations | No restore drill for backups | Owner's choice; accepted risk |
