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
