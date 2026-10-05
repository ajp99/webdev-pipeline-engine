# Decision log

Every locked decision, with its area and reason. Source of the spec decisions: the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05) and the review sessions that produced it. Where no reason was recorded, the entry says "Owner's choice". New decisions are appended; superseded ones stay with a note.

| ID | Area | Decision | Reason |
| --- | --- | --- | --- |
| D-001 | Scope | Internal tool for one owner (freelance/agency pipeline); not multi-tenant | Owner's choice |
| D-002 | Scope | Marketing sites and landing pages only | Owner's choice |
| D-003 | Autonomy | Human-in-the-loop: owner approves every stage | Owner's choice |
| D-004 | Orchestration | Agent SDK workers plus Supabase state behind a swappable stage runner interface | Workers run on the owner's machine and approvals live in the database; a workflow engine (Inngest, Trigger.dev) can replace the runner later |
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
