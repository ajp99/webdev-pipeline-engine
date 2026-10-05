# Security and credentials

> Snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (as of 2026-10-05). From this commit the repo is the source of truth. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

The main risks are agents with shell access on the owner's own machine, client data in Supabase, and credentials in the handover.

- **Worker isolation:** run each stage in a per-project working directory; give workers only a scoped GitHub token and a scoped Vercel token for that project. Never expose personal or account-wide tokens to workers.
- **Approval enforcement:** stage transitions happen only through a server-side function that checks for an approval record; agents cannot write to `stage` directly.
- **Row-level security:** clients see only their own project's client-facing rows; owner role is separate and verified server-side. The owner account uses email + password with no multi-factor for now (accepted risk).
- **Client accounts:** email + password through Supabase Auth, with password-strength rules and rate limiting; accounts stay active after close until the owner disables them manually, and a project can have several client logins, any of which can approve.
- **Secrets:** environment variables for API keys; no client secrets stored in the pipeline database. Client-owned secrets (such as a Resend key) are entered directly into the client's own Vercel project when possible.
- **Handover document:** generated once and shared manually by WhatsApp or email. It may contain credentials, which the owner accepts as a known risk.
- **Data handling:** uploaded assets are stored in private Supabase storage and deleted, together with intake data, 90 days after close (adjustable per project).
- **Agent safety:** treat client-supplied text and uploads as untrusted input to agents (prompt-injection risk); agents cannot run commands outside the project directory, and destructive commands require owner approval.
