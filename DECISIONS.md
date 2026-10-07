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
| D-012 | Prototype | Single-page prototype of the main page, at most 2 revision cycles. The clickable-preview part is superseded by D-114 | Owner's choice |
| D-013 | Build rounds | Agent proposes round count and scope from pages and features; owner approves (about 2 simple, 4 larger) | Owner's choice |
| D-014 | Gates | Three gate types (soft, hard, client); no auto-advance; overdue gates only show a badge after 24 hours (per-stage, per-project overridable) | Owner's choice; keeps "owner approves every stage" intact |
| D-015 | Gates | Prototype has two approval records (owner soft, then client); PRD lock is one client gate with owner edits part of the stage; QC results and report are one gate | Owner's choice |
| D-016 | Gates | Owner actions: Accept, Feedback (new version), Reject (no new version); hard gates have no extra confirmation | Owner's choice |
| D-017 | Final acceptance | No client approval before go-live; client sees the final site once live; changes until handover complete go through change requests; after close, outside the pipeline | Owner's choice |
| D-018 | Questions | ask-client backlog questions are answered by the client in the dashboard | Owner's choice |
| D-019 | QC | Lighthouse 80+, basic SEO, generic checklist; at most 2 fix loops, then the owner accepts or fixes manually | Owner's choice |
| D-020 | Skills | Library of SKILL.md files in this repo (`skills/`); lifecycle project-local, candidate, library, deprecated; two owner reviews (match, then diff); automated checks only; optional good/bad marks; agent may propose deprecation; manual promotion stays | Owner's choice |
| D-021 | Site architecture | Static-first Next.js, MDX/JSON content, blog, contact form emailed over SMTP (the Resend part is superseded by D-156), no database; spam protection chosen per project (superseded by D-162) | Owner's choice |
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
| D-045 | Notifications | Clients receive emails (sent over SMTP from D-167; originally Resend) for four events (intake follow-ups ready, PRD ready, prototype ready, ask-client question waiting); owner alerts: see D-200 (originally dashboard-only) | Otherwise a client is never told something is waiting |
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
| D-070 | Intake | Templates support text (short and long), choices (single and multiple), file upload, and links | Owner's choice |
| D-071 | Intake | A new industry template is generated from the industry name plus the owner's notes | Owner's choice |
| D-072 | Intake | Required fields are set by the owner per template (a `required` flag on each question) | Owner's choice |
| D-073 | Intake | The client form shows one section per step, with a progress bar, saving as the client goes | Owner's choice |
| D-074 | Intake | The client submits each round explicitly and can reopen it until the agent has reviewed it | Owner's choice |
| D-075 | Uploads | 25 MB maximum per file. Allowed types are set by D-076 and D-100 | Owner's choice |
| D-076 | Uploads | Zip files are not allowed | An archive can hide oversized or malicious files; hostile client content is the prompt-injection risk |
| D-077 | Intake | At most 8 follow-up questions per round | Owner's choice |
| D-078 | Intake | The agent reviews each submitted round in one batch. After the review the client's answers are locked; only the owner can edit them and send the round back for another review | Owner's choice |
| D-079 | Intake | Lock cycle: open, submitted, reviewed (locked), then unlocked for the follow-up round, where the client may also change earlier answers | Owner's choice |
| D-080 | Intake | The owner's edits to a client's answer overwrite it, with no history | Owner's choice; accepted risk: the client's original wording is lost |
| D-081 | Runner | One ticket per project at a time, and at most 2 projects in parallel (adjustable) | Avoids head-of-line blocking without overloading the laptop or the API limits |
| D-082 | Runner | A failed run is retried once automatically, then fails to the owner's queue | Owner's choice |
| D-083 | Runner | No time limit on runs; the heartbeat and the cost warning only | Owner's choice; accepted risk: a runaway agent loop keeps a fresh heartbeat |
| D-084 | Runner | Run logs are stored as text rows in the database | Owner's choice |
| D-085 | Runner | Run logs are deleted 90 days after project close, with the rest of the project's data | Owner's choice |
| D-086 | PRD | The PRD is a fixed list of structured sections, each written in markdown | Easy to diff, edit and generate |
| D-087 | PRD | The client can Sign off or Request changes with a note that goes to the owner, not to agents | Gives a client who disagrees a way to say so in the dashboard |
| D-088 | PRD | The owner edits the PRD in markdown text areas with a live preview and a side-by-side version diff | Owner's choice |
| D-089 | PRD | The client sees the latest PRD version plus an agent-written summary of what changed since they last looked | Owner's choice |
| D-090 | Change requests | Clients submit change requests in the dashboard from go-live until handover is complete | Owner's choice |
| D-091 | Notifications | Client emails are in English only | Owner's choice |
| D-092 | Notifications | One email per event and no reminders | Owner's choice; a silent client simply stalls and only the owner's overdue badge shows it |
| D-093 | Phase 2 gate | Evidence is a manual walkthrough, an automated end-to-end test (model responses stubbed), and a cost report | Owner's choice |
| D-094 | Accounts | Client accounts are created by an invite email with a link to set a password | Owner's choice |
| D-095 | Templates | The owner edits an industry template as text (markdown or JSON) in the console | Owner's choice |
| D-096 | Owner notes | Private per-project owner notes that agents read and clients never see, stored in an owner-only table | Clients can read their own project row, so notes cannot be a column on it |
| D-097 | PRD | The round plan is removed from the PRD (the Planner owns it); the internal gap and conflict list is a separate owner-only artifact | The spec listed a round plan in the PRD and also had the Planner set rounds after lock |
| D-098 | Uploads | Uploads are scanned for malware in the worker before any agent sees them; agents never open documents with macros | Owner's choice |
| D-099 | Agents | The intake agent starts on Haiku 4.5 and moves up if quality is poor | Cheapest start; the owner judges quality |
| D-100 | Uploads | Allowed types: PNG, JPEG, WebP, SVG (sanitized), PDF, DOCX, plain text, markdown, JSON and MP4, up to 25 MB each. Agents treat MP4 as an asset only | Owner's choice |
| D-101 | Starter | Pages are built from the starter's section library, plus new components the agent writes when needed | Owner's choice |
| D-102 | Starter | Styling is Tailwind plus whatever the agent chooses per site | Owner's choice; sites will differ, so the plan records what was chosen and the handover guide describes it |
| D-103 | Starter | The client edits MDX (pages and posts) and JSON (settings and navigation); schema checks run at build with plain-language errors | Owner's choice |
| D-104 | Starter | The Builder may add dependencies named in the approved plan; any others need the owner's approval at the round gate | Owner's choice; the approval comes after the fact, since the dependency is already in the round's PR |
| D-105 | Skills | An agent drafts the first skills; the owner reviews them | Owner's choice |
| D-106 | Skills | The Planner selects skills per project and the worker loads only those into the run | Least context per run |
| D-107 | Skills | A script scans `skills/` and updates the registry, at worker start and before each run | The worker cannot see GitHub merges directly |
| D-108 | Plan | The plan is structured fields (rounds with scope, skills, dependencies, budget) plus a markdown rationale per section, edited as text | Machine-readable for rounds, readable for the owner |
| D-109 | Plan | The plan proposes the project's budget and the owner confirms it when approving the plan (units set by D-138 and D-140) | Owner's choice |
| D-110 | Prototype | The prototype uses real copy drafted from the intake, with every factual claim highlighted for the owner's review | Owner's choice |
| D-111 | Prototype | The prototype stage produces one design | Owner's choice |
| D-112 | Intake | The generic intake template includes a design section: visual style, reference sites liked and disliked, colors and fonts, imagery style | Owner's choice |
| D-113 | Prototype | Client feedback on the prototype is one free-text box per revision | Owner's choice |
| D-114 | Prototype | The client sees the prototype as screenshots only; no live preview is shared. Previews stay behind Vercel's login and only the owner views them. Supersedes the clickable part of D-012 | Owner's choice |
| D-115 | Prototype | Screenshots are full-page desktop and full-page mobile | Owner's choice |
| D-116 | QC | The worker builds the site and serves it locally; screenshots, Lighthouse and Playwright run against that build | Free; slightly different from Vercel |
| D-117 | Final screenshots | No live preview is shared with the client before go-live. After the build and testing are complete, new screenshots are shared | Owner's choice; accepted risk: the client first uses the real site after go-live |
| D-118 | Final screenshots | The client can view the final screenshots and comment; a note comes to the owner and approval stays with the owner | Owner's choice |
| D-119 | Final screenshots | No email when the final screenshots are shared | Owner's choice |
| D-120 | Prototype | A revision cycle starts each time the owner sends feedback to the agent for a new prototype version; the first version does not count | Owner's choice |
| D-121 | Starter | Images come from client uploads, plus placeholder images with descriptive alt text; placeholders are clearly marked | Avoids unlicensed stock or generated images |
| D-122 | Evals | The Planner eval fixtures are 3 fictional clients: a dental clinic, a law firm and a restaurant | Owner's choice |
| D-123 | Provisioning | The provisioning script resumes where it stopped, has a cleanup command and has a dry-run mode | Owner's choice |
| D-124 | Prototype | No agent self-check on the prototype; the owner reviews the screenshots directly | Owner's choice |
| D-125 | Prototype | The client can Approve the prototype, or Request changes with a required note, the same pattern as the PRD | Owner's choice |
| D-126 | Plan | The Planner follows a rule of thumb for the number of rounds (5 pages or fewer and no blog is 2 rounds, otherwise 4); the owner can override | Owner's choice |
| D-127 | Phase 3 gate | Evidence is the phase 2 evidence (manual walkthrough, automated end-to-end test with stubbed model responses, cost report) plus the Planner eval results on the 3 fixtures | Owner's choice |
| D-128 | Builder | Before a round's pull request opens, the build, lint, typecheck and content schema checks must pass | Owner's choice |
| D-129 | Builder | The Builder records an assumption and continues; only a true blocker (something it cannot work around) stops the round and is flagged to the owner | Owner's choice |
| D-130 | Builder | Shell commands run from an allowlist, with installs run without install scripts and refused commands logged to the backlog; a short list of risky commands pauses the run and asks the owner | Hostile client text could talk an agent into damaging commands |
| D-131 | Builder | The commands that pause the run are: deleting a directory or many files, and force-pushing or rewriting git history. Other network requests are refused, and dependency installs outside the plan are allowed but flagged at the round gate | Owner's choice |
| D-132 | Builder | A run waiting for the owner's answer keeps its concurrency slot | Owner's choice; accepted risk: an unanswered request can occupy a slot indefinitely |
| D-133 | Rounds | At most 3 Feedback loops per round, then the owner must Accept or Reject | Owner's choice |
| D-134 | Rounds | For each ask-client answer the owner chooses whether it waits for the next round or triggers an immediate fix on the open PR | Owner's choice |
| D-135 | Rounds | After each approved round the Planner re-plans the remaining rounds using the owner's answers, and the owner approves the updated plan before the next round starts | Owner's choice |
| D-136 | Rounds | A round's pull request is merged into `staging` with a merge commit, keeping every commit | Owner's choice |
| D-137 | Handover | The client receives a fresh repo with clean history; the pull requests stay with the owner | The client would otherwise inherit every commit message, PR description and internal note |
| D-138 | Cost | Token use is shown as a progress bar against the project's budget, with no warnings | Owner's choice; accepted risk together with D-083 |
| D-139 | Handover | The client creates an empty repo and adds the owner; an owner-run script pushes the clean commit there | Owner's choice |
| D-140 | Cost | Costs are shown in tokens only, with no dollar amounts; budgets are in tokens | Owner's choice |
| D-141 | Phase 4 gate | Evidence is two real rounds on the dental fixture (with a re-plan, Feedback loops, a risky-command pause and an ask-client answer), an automated round-loop test with stubbed model responses, table-driven allowlist tests, and a cost report | Owner's choice |
| D-142 | Repo process | The phase 3 and 4 change set is stacked on the open phase 2 branch | Owner's choice |
| D-143 | Builder | Agent-written factual claims are wrapped in a `<Claim>` marker component that renders normally; the round summary lists every claim, approving the round clears them, and QC fails if an uncleared marker remains | Makes the claim review checkable |
| D-144 | Builder | The Builder uses Sonnet 5.5 by default; the plan flags hard rounds for Opus 5.5 and the owner approves that with the plan | Owner's choice |
| D-145 | Builder | Agents keep a notes file in the client repo (`.pipeline/NOTES.md`), removed by the clean-history handover; agents never copy the owner's private notes into it | Owner's choice |
| D-146 | Builder | All cleared claim markers are stripped at deploy prep by a script; QC checks that every marker belongs to a cleared claim | Owner's choice |
| D-147 | QC | Lighthouse and Playwright run on the key pages listed in the approved plan | Owner's choice |
| D-148 | QC | After a failed QC the owner approves the fix list and the Builder commits the fixes directly to `staging`, with at most 2 fix loops | Owner's choice |
| D-149 | QC | QC tests the contact form with a stubbed mail transport: it checks that the form validates, submits and returns success | Owner's choice; real delivery is proven by D-150 |
| D-150 | Deployment | The post-deploy smoke test sends one real contact-form submission to a test address the owner sets; the owner then switches the recipient to the client's | Owner's choice |
| D-151 | Deployment | When the client's domain is not ready, whether to go live on the Vercel address (set to noindex until the custom domain is attached) or wait for the domain is decided per project | Owner's choice |
| D-152 | Deployment | (Superseded by D-166) The DNS step list covered website records, plus Resend records when the PRD said the form sends from the client's own domain | Replaced when Resend was dropped |
| D-153 | Deployment | (Superseded by D-156) The client would hold their own Resend account from the start | Replaced when Resend was dropped |
| D-154 | Handover | The GitHub web-editor guide is one generic template with demo screenshots in written steps; each project adds only a list of its own content files | Owner's choice |
| D-155 | Handover | The client creates their own Vercel project from the fresh repo, the owner deletes the old project, and environment variables are re-entered from the handover document | Owner's choice |
| D-156 | Forms | Contact forms on client sites send mail over SMTP; Resend is not used unless the PRD names it. Supersedes the Resend parts of D-021, D-045, D-152 and D-153 | Owner's choice; mail goes through the client's own mailbox, so no sending-domain DNS and no extra account |
| D-157 | Forms | The starter's mail transport supports generic SMTP (host, port, user, password), Google Workspace or Gmail with an app password, and Microsoft 365 with OAuth 2.0 | Microsoft has announced that basic SMTP sign-in is switched off by default for new tenants from December 2026 and removed later, so the starter does not rely on it |
| D-158 | Forms | Which mailbox a form sends through (a dedicated one or the client's main one) is decided per project | Owner's choice |
| D-159 | Forms | Which forms a site has (a contact form only, or also quote or booking requests) is decided by the PRD | Owner's choice |
| D-160 | Forms | When sending fails the visitor sees an error screen with the phone number and plain contact links; no archive or fallback copy of the submission is kept | Owner's choice; accepted risk: a failed submission can be lost |
| D-161 | Forms | No monitoring of form delivery after handover; the handover guide tells the client how to test the form | Owner's choice; accepted risk: a broken mailbox login goes unnoticed until someone tests |
| D-162 | Forms | Every form always has a honeypot field, a time-based check and a best-effort in-memory rate limit per serverless instance; the PRD adds more (such as Cloudflare Turnstile) when needed | Owner's choice; the in-memory limit is weak, so the honeypot and time check do most of the work |
| D-163 | Forms | Whether the visitor gets an automatic reply is decided per project in the PRD | Owner's choice |
| D-164 | Forms | Whether the form has a consent checkbox is decided per project in the PRD, depending on the client's region | Owner's choice |
| D-165 | Forms | Forms accept file attachments only when the PRD asks for it | Owner's choice |
| D-166 | Deployment | The DNS step list covers website records only; mail records appear only if the PRD names a provider that needs them. Supersedes D-152 | Follows D-156 |
| D-167 | Notifications | The pipeline's own emails (client notifications) go out over SMTP from the owner's Gmail account with an app password. Supersedes the Resend part of D-045 | Owner's choice |
| D-168 | Auth | Supabase's invite and password-reset emails use Supabase's custom SMTP with the same Gmail account | Owner's choice |
| D-169 | Retention | A scheduled worker job deletes uploads, intake data and run logs automatically when a project's retention date arrives, with no confirmation step, and records `data_deleted_at`; a client's request for earlier deletion is handled by hand outside the pipeline | Owner's choice |
| D-170 | Handover | Clients own everything after handover; there is no shared forms service and no other ongoing dependency on the owner | Owner's choice |
| D-171 | Phase 5 gate | Evidence is the pilot report (against the pilot measures in 15-operations.md, D-064), a cost report in tokens, and automated tests of the QC runner, the fix loop and a dry run of the handover script | Owner's choice |
| D-172 | Pilot | The pilot runs up to deployment on the Vercel address and then a handover to a second GitHub account, with no custom domain. Refines D-064 | Owner's choice; accepted risk: the DNS and custom-domain steps are not exercised by the pilot |
| D-173 | Handover | The handover pack is documentation inside the client's fresh repo (a README and an editing guide), plus a PDF of the editing guide | Owner's choice |
| D-174 | Change requests | An accepted change request after go-live runs as a mini-round: the Builder works on a `cr-N` branch with a pull request into `staging`, the owner Accepts, and a deploy step (a hard gate) merges `staging` into `main` | Owner's choice |
| D-175 | Change requests | A change-request mini-round gets the round checks only (build, lint, typecheck, content schema); there is no QC re-run | Owner's choice; accepted risk: a regression Lighthouse would catch can reach production |
| D-176 | Handover | The owner marks the handover complete; the client is not asked to confirm | Owner's choice |
| D-177 | MCP | The read-only MCP server stays optional and its timing is decided after the pilot, since the owner is not sure it is needed; task P5-T08 is deferred until then. Revisits the timing in D-057 | Owner's choice |
| D-178 | Intake | The generic template's design section asks for visual style cards (pick 1 or 2) and layout density; up to 3 reference sites with what the client likes about each; colors and font styles with an optional brand guideline upload; and imagery style and things to avoid | Owner's choice |
| D-179 | Intake | Style choices come from a fixed set of style cards (images the form shows) plus free text | Owner's choice |
| D-180 | Plan | The plan holds a design brief section (palette, fonts, layout approach, references), approved with the plan; the Prototype agent builds from it | Owner's choice |
| D-181 | Intake | The form shows 4 style cards | Owner's choice |
| D-182 | Intake | The style cards are built in phase 2 as standalone sample pages rendered to images, so the intake works fully from the start | Owner's choice |
| D-183 | Intake | The intake asks about an existing website as one text question (its URL, what to keep, what to change); no screenshot is taken of it | Owner's choice |
| D-184 | Intake | The intake requires a logo upload or an explicit answer that there is none, in which case the site uses a text wordmark in the chosen font | Owner's choice |
| D-185 | Design | Unless the PRD says otherwise: subtle motion only with reduced-motion preferences respected, no dark mode, and mobile-first layouts | Owner's choice |
| D-186 | Fonts | (Superseded by D-187) Google Fonts loaded at run time | Replaced after the trade-off was explained |
| D-187 | Fonts | Sites use the Google Fonts catalog, downloaded at build time and served from the site's own domain (`next/font`), with no requests to Google at run time | Owner's choice; no third-party request on page load |
| D-188 | Intake | A controlled tool opens only the URLs the client listed as reference sites (up to 3) and takes screenshots for the agent and the owner. It accepts public web addresses only (no localhost, private network ranges or cloud metadata addresses), has a short timeout, gives the agent screenshots rather than page text, and stores them privately for deletion with the project's other data. A narrow exception to D-131 | Owner's choice |
| D-189 | Design | An agent proposes 4 distinct style directions (such as minimal, bold, warm, corporate) and the owner approves them | Owner's choice |
| D-190 | Language | Client sites are in English only in version 1 | Owner's choice |
| D-191 | Hosting | The client takes over a Vercel project on the plan Vercel requires for commercial use (as far as the spec author knows, a paid one); the handover documentation says so | Owner's choice |
| D-192 | Privacy | The dashboard links to a privacy page that an agent drafts and the owner reviews; it names what is stored, who processes it and the 90-day retention; there is no first-login acceptance step | Owner's choice |
| D-193 | Change requests | Each change request shows a status in the client dashboard (received, accepted, deferred, declined, deployed); no email is sent | Owner's choice |
| D-194 | Final screenshots | Deployment never waits for the client's notes on the final screenshots; notes that arrive later become change requests after go-live | Owner's choice |
| D-195 | Starter | The starter emits Open Graph tags plus JSON-LD (Organization or LocalBusiness) generated from the settings JSON | Owner's choice |
| D-196 | Secrets | The worker's secrets (Anthropic key, Supabase service key, GitHub App key, Gmail app password) live in a gitignored `.env` file in the worker's folder and rely on full-disk encryption of the owner's laptop | Owner's choice; accepted risk: secrets sit in plain text on disk |
| D-197 | Dashboard | Clients use the default `vercel.app` address for the dashboard; invite emails link to it | Owner's choice |
| D-198 | Supabase | The pipeline runs on Supabase's free plan until the pilot, then on Pro before a real client uses it | Owner's choice; as far as the spec author knows, free projects can pause when idle and have no managed backups |
| D-199 | Development | Development and tests use a local Supabase through the Supabase CLI and Docker | Owner's choice |
| D-200 | Owner alerts | The owner is emailed when a gate is ready, when a run is waiting on a pause request, and when a run fails, through the Gmail SMTP of D-167; overdue gates stay a console badge only. Supersedes the dashboard-only alerts of D-045 | Owner's choice |
| D-201 | Worker | The owner starts the worker by hand in a terminal for now, inside WSL2 on Windows, and the worker keeps the laptop awake only while a run is active | Owner's choice |
| D-202 | API | One Anthropic API key serves all projects, and no hard monthly spend limit is set in the Anthropic console | Owner's choice; accepted risk: a runaway run is limited only by the token progress bar |
| D-203 | Worker | A project's working folder is kept until the project closes and is reset at the start of every run (uncommitted files discarded, the right branch checked out) | Owner's choice |
| D-204 | Runner | A model call that is rate-limited or overloaded waits with backoff and resumes, and does not use an attempt | Owner's choice |
| D-205 | Dashboard | The client dashboard is mobile-first | Owner's choice; clients will often approve from a phone |
| D-206 | Auth | The owner login stays email and password with no multi-factor | Owner's choice; accepted risk already in 12-security.md |
| D-207 | Auth | Client invite links are valid for 7 days, and the console has a Resend invite button | Owner's choice |
| D-208 | Handover | After handover the owner offers a bug-fix window of about 30 days, handled outside the pipeline | Owner's choice |
| D-209 | Starter | No analytics unless the PRD asks for them | Owner's choice |
| D-210 | QC | The single 80+ Lighthouse gate stays for every category, accessibility included | Owner's choice |
| D-211 | Uploads | Original client images are committed to the site's repo as uploaded; site images over 5 MB are rejected at upload (documents and video keep the 25 MB limit) | Owner's choice; accepted risk: large originals make the repo and builds heavier |
| D-212 | Dashboard | Once the handover is marked complete the client dashboard is read-only and shows only the handover guide and its PDF | Owner's choice; refines D-094 and D-090 |
| D-213 | Handover | After handover the client edits the site however they choose and asks the owner for help outside the pipeline; the pipeline prescribes no editing flow | Owner's choice |
| D-214 | Accounts | Client accounts stay until the owner disables them by hand; the 90-day deletion job removes data, not accounts | Owner's choice |
| D-215 | Repo process | Phases 3 to 5 and the design section go in as one combined branch and pull request stacked on the phase 2 branch; the change set is checked first, then pushed with the owner's existing token, which the owner then revokes | Owner's choice |
