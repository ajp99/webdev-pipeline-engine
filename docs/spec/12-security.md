# Security and credentials

> Originally a snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05). The repo is the source of truth; this file includes the owner-approved decisions D-038 to D-069 recorded in `DECISIONS.md`. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

The main risks are agents with shell access on the owner's own machine, client data in Supabase, and credentials in the handover.

- **Worker isolation:** run each stage in a per-project working directory; give workers only a short-lived GitHub App token limited to that project's repository. Workers hold no Vercel token. Never expose personal or account-wide tokens to workers.
- **Approval enforcement:** stage transitions happen only through a server-side function that checks for an approval record; agents cannot write to `stage` directly.
- **Row-level security:** clients see only their own project's client-facing rows; the owner role is membership in the `owners` table, checked in the database. The owner account uses email + password with no multi-factor for now (accepted risk).
- **Client accounts:** email + password through Supabase Auth, with password-strength rules and rate limiting; accounts stay active after close until the owner disables them manually, and a project can have several client logins, any of which can approve.
- **Secrets:** environment variables for API keys; no client secrets stored in the pipeline database. Client-owned secrets (such as a Resend key) are entered directly into the client's own Vercel project when possible.
- **Handover document:** generated once and shared manually by WhatsApp or email. It may contain credentials, which the owner accepts as a known risk.
- **Data handling:** uploaded assets are stored in private Supabase storage and deleted, together with intake data, 90 days after close (adjustable per project).
- **Agent safety:** treat client-supplied text and uploads as untrusted input to agents (prompt-injection risk); agents cannot run commands outside the project directory, and destructive commands require owner approval.
- **GitHub webhook:** verify GitHub's signature, accept a merge as Accept only when the merger is the owner's GitHub account, and make it idempotent so a console-triggered merge is not recorded twice.
- **Backups:** the database is exported on a schedule and before each project close, encrypted, saved locally and copied to the owner's own cloud drive. Exports never go into this repo (`.gitignore` excludes them). The encryption key lives in a password manager. There is no restore drill (accepted risk).
- **Repo hygiene:** the repo is public. GitHub secret scanning and push protection are on; CI and branch protection come later.
- **Uploads:** allowed types are PNG, JPEG, WebP, SVG, PDF, DOCX, plain text, markdown, JSON and MP4, up to 25 MB each, with no zip files. Each upload is scanned for malware in the worker before any agent sees it, SVG is sanitized, agents never open documents with macros, and MP4 is treated as an asset only. The scanner is installed on the owner's machine.
- **Owner notes:** stored in an owner-only table, because clients can read their own project row. The Requirements agent must not quote them in anything the client sees.
- **Run logs:** stored as database rows, may contain client data, and are deleted 90 days after project close.
- **Builder commands:** shell commands run from an allowlist with installs run without install scripts; deleting a directory or many files, and force-pushing or rewriting git history, pause the run for the owner's answer; everything else (including other network requests) is refused and logged. A waiting run keeps its slot.
- **Previews:** Vercel previews stay behind Vercel's login and only the owner views them. Screenshots and QC measurements come from a local build the worker serves. No share links, no preview gate.
- **Notes file:** `.pipeline/NOTES.md` in the client repo may not contain the owner's private notes. The clean-history handover leaves it behind.
