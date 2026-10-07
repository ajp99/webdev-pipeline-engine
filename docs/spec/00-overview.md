# Summary and locked decisions

> Originally a snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05). The repo is the source of truth; this file includes the owner-approved decisions D-038 to D-069 recorded in `DECISIONS.md`. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

CreatePipeline Engine is a single-owner internal system that takes a marketing-site client from intake to handover, with agents doing the work and the owner approving every step. Orchestration is Supabase-backed state with local workers, behind a swappable runner.

| Area | Locked decision |
| --- | --- |
| Product | Internal tool for one owner (freelance/agency pipeline); not multi-tenant |
| Project type | Marketing sites and landing pages |
| Autonomy | Human-in-the-loop: owner approves every stage; three gate types (soft, hard, client), no auto-advance, overdue gates only get a badge |
| Orchestration | Agent SDK workers plus Supabase state; the runner polls a durable queue (`stage_runs`) every 15 to 30 seconds; stage runner interface so Inngest or Trigger.dev can replace it later |
| Worker host | Owner's own machine (must be online while a stage runs) |
| Intake | Hybrid: industry templates plus agent follow-ups on vague answers. The agent reviews each submitted round in one batch (up to 8 follow-ups, cap of 3 follow-up rounds); answers lock after review |
| Industry templates | Agent generates from the industry name plus the owner's notes; owner edits as text and approves; then saved to library |
| Client assets | Optional uploads (PNG, JPEG, WebP, SVG sanitized, PDF, DOCX, plain text, markdown, JSON, MP4; 25 MB each; no zip; scanned for malware); agent structures and generates copy |
| Client login | Email + password accounts, created by an invite email with a link to set a password; links last 7 days and the console can resend an invite; the dashboard is mobile-first |
| Client dashboard | Intake, progress tracker, PRD sign-off or request changes, prototype screenshots with approve or request changes, final screenshots with comments, change requests during the live period |
| Client comments | Prototype and final-screenshot notes, PRD change-request notes and live-period change requests reach the owner first as raw text; the owner decides what goes to agents |
| Prototype | One design of the main page, with real drafted copy (claims highlighted), shown to the client as full-page desktop and mobile screenshots only; at most 2 revision cycles |
| Build rounds | Agent proposes round count and scope from pages and features; owner approves (about 2 for simple, 4 for larger) |
| Skills | Reusable Git library of SKILL.md files; project skills move project-local, candidate, library, deprecated, with owner review at match confirmation and at the generalization diff |
| Site architecture | Static-first Next.js, MDX/JSON content, blog, contact form emailed over SMTP, no database; Open Graph tags and JSON-LD; no analytics unless the PRD asks |
| QC bar | Lighthouse 80+ in every category on the plan's key pages, basic SEO checks, simple generic checklist passing |
| Alerts | Owner: approval queue with badge counts and overdue badges, plus an email when a gate is ready, a run waits on a pause request, or a run fails. Clients: emails over SMTP from the owner's Gmail for four events (intake follow-ups ready, PRD ready, prototype ready, ask-client question waiting); no email for change-request status or final screenshots |
| Hosting | Owner hosts on Vercel first, ownership transferred at handover; Vercel deploys through its Git integration (rounds on `staging`, production from `main`); the client takes over a Vercel project on the plan Vercel requires for commercial use |
| Post-handover edits | Client edits MDX/JSON via GitHub web editor using a short generic guide with demo screenshots; help is asked of the owner outside the pipeline, with a bug-fix window of about 30 days |
| Credentials | Ownership transfers plus a handover document shared manually by WhatsApp or email; it may contain credentials (accepted risk) |
| Domain and DNS | Handled manually by owner or client, per client; the DNS step list covers website records only; going live on the Vercel address before the domain is ready is decided per project |
| Final acceptance | No client approval before go-live; the client sees the final site once it is live, and changes until handover is complete go through change requests; final screenshots are shared after QC |
| Project close | The client gets a fresh repo with clean history, scoped tokens revoked, read-only archive; uploads and intake data deleted 90 days after close (adjustable per project); client accounts stay active until the owner disables them; after close the client dashboard is read-only and shows only the handover guide and its PDF; a scheduled job deletes the data at the retention date |
| Legal pages | Every site gets a privacy policy and cookie notice drafted by the agent for owner review |
| Copy claims | Agents may draft plausible copy; every factual claim is highlighted for owner review |
| Lifecycle | Projects can be paused; a cancelled project is closed and archived; changes after close are handled outside the pipeline |
| Round review | Each build round is a pull request into the client repo's `staging` branch; console Accept merges it, Feedback comments on it, Reject closes it; a round's PR is merged with a merge commit; at most 3 Feedback loops per round; a merge by the owner's GitHub account also counts as Accept (webhook) |
| Worker access | GitHub App with short-lived tokens limited to one client repo per run; workers hold no Vercel token; an owner-run provisioning script sets up each project |
| Operations | Encrypted database exports on a schedule and before each close; GitHub secret scanning on, CI and branch protection later; automated agent evals (Planner first, Opus 5.5 judge); pilot on the owner's own site up to deployment on the Vercel address and a handover to a second GitHub account; optional read-only MCP server decided after the pilot (see 15-operations.md) |
| PRD | A fixed list of structured sections, each in markdown; the client sees the latest version plus an agent-written summary of changes; the gap and conflict list is owner-only; no round plan (the Planner owns it) |
| Runner behavior | One ticket per project, at most 2 projects in parallel; one automatic retry; no time limit; a run waiting for the owner keeps its slot; logs stored as database rows and deleted 90 days after close |
| Owner notes | Private per-project notes that agents read and clients never see |
| Starter | Section library plus agent-written components; Tailwind with agent-chosen styling; MDX for pages and posts and JSON for settings and navigation, with schema checks at build; placeholder images with descriptive alt text |
| Plan | Structured fields plus a markdown rationale; proposes the token budget and the round count (5 pages or fewer and no blog is 2 rounds, otherwise 4); re-planned after each round with the owner's approval |
| Builder | Sonnet 5.5 by default (Opus 5.5 for rounds the plan flags); command allowlist, two command types pause for the owner, other commands refused; a blocker stops a round, other questions become assumptions; claim markers for factual claims |
| Cost view | Tokens only, as a progress bar against the plan's token budget; no warnings |
| Forms | Mail goes over SMTP (generic SMTP, Google Workspace or Gmail app password, Microsoft 365 OAuth 2.0), not Resend, unless the PRD names another provider; every form has a honeypot, a time check and a best-effort rate limit; the PRD decides which forms, the mailbox, an auto-reply, a consent checkbox and attachments; a failed send shows the phone number and plain contact links, with no archive |
| Design | The intake's design section uses 4 style cards, up to 3 reference sites, colors and fonts with an optional brand upload, and imagery notes; the plan holds a design brief; fonts come from the Google Fonts catalog, served from the site's own domain; defaults are subtle motion, no dark mode and mobile-first |
| Language | English only in version 1 |
| Owner setup | Worker started by hand inside WSL2, laptop kept awake while a run is active; secrets in a gitignored `.env`; one Anthropic key; Supabase free until the pilot, then Pro; local Supabase through the CLI and Docker for development; no owner multi-factor and no spend cap (accepted risks) |
| Change requests after go-live | Clients see a status (received, accepted, deferred, declined, deployed); an accepted request runs as a `cr-N` mini-round with the round checks only, and a hard-gate deploy step merges `staging` into `main` |
