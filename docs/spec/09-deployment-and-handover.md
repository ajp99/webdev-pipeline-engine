# Deployment and handover

> Originally a snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05). The repo is the source of truth; this file includes the owner-approved decisions D-038 to D-069 recorded in `DECISIONS.md`. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

The site is hosted under the owner's accounts during the project, then ownership moves to the client at handover. Vercel's free plan is non-commercial as far as the spec author knows, so hosting client sites under the owner's account needs a paid Vercel plan; verify this before the pilot.

**Project setup:** an owner-run provisioning script creates the repo from the master starter, installs the GitHub App on it, creates and links the Vercel project (production branch `main`, previews from `staging`), and records the IDs in `projects`. Workers never receive broader credentials.

**Deployment preparation (after report approval):**

1. Production environment variables set by the owner in the client's Vercel project, form mailbox settings (SMTP host, user and password, or Microsoft 365 OAuth details) entered where the PRD calls for a form, analytics only if the PRD asks for it.
2. Production build verified on `staging`; a script strips all cleared claim markers; then `staging` is merged into `main`, which Vercel deploys to production through its Git integration.
3. Domain and DNS handled manually by the owner or the client; the agent produces the exact website DNS records and a step list. Mail records appear only if the PRD names a provider that needs them. Whether to go live on the Vercel address (set to noindex until the custom domain is attached) or wait for the domain is decided per project.
4. Post-deploy smoke test against the live URL, including one real contact-form submission to a test address the owner sets; the owner then switches the recipient to the client's.

**Handover pack (Handover agent drafts, owner approves):**

- Project documentation inside the client's fresh repo (a README and an editing guide): structure, content files, how to run locally, how to test the contact form
- GitHub web-editor guide: one generic template with demo screenshots in written steps (edit MDX/JSON content, add a blog post, commit); each project adds only a list of its own content files. A PDF of the guide is delivered too
- Ownership transfer checklist: the client creates an empty GitHub repo and adds the owner; an owner-run script pushes a single clean commit (no round history, no pull requests, no `.pipeline/` notes); the client creates their own Vercel project from the fresh repo, the owner deletes the old project, and environment variables are re-entered from the handover document; domain registrar notes; the documentation states that the client's Vercel project needs the plan Vercel requires for commercial use
- Handover document listing remaining credentials and settings, shared manually by WhatsApp or email
- Maintenance notes and known limitations

Go-live happens at deployment preparation, and the client sees the final site only once it is live. Change requests apply from go-live until the owner marks the handover complete. A project is closed when the owner marks the handover complete: the client owns the fresh repo and the Vercel project, while the original repo, its pull requests and the notes file stay with the owner, scoped tokens are revoked, and the project becomes a read-only archive. Uploads and intake data are deleted 90 days after close (adjustable per project), and changes after close are handled outside the pipeline. The owner marks the handover complete; the client is not asked to confirm. After that the client dashboard is read-only and shows only the handover guide and its PDF, and the owner offers a bug-fix window of about 30 days outside the pipeline. A scheduled job deletes uploads, intake data and run logs when the retention date arrives and records `data_deleted_at`; client accounts stay until the owner disables them. A final database export runs before close.
