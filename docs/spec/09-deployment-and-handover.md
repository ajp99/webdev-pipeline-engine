# Deployment and handover

> Originally taken from a Claude Doc (2026-10-05) that has since been retired. The repo is the source of truth; this file reflects the owner-approved decisions recorded in `DECISIONS.md`. Agents change files in `docs/spec/` only after the owner approves a proposal in `docs/proposals/` (see `AGENTS.md`).

The site is hosted under the owner's accounts during the project, then ownership moves to the client at handover. Vercel's free plan is non-commercial as far as the spec author knows (unverified), so the owner's Vercel account moves to a paid plan from the first real client; the pilot on the owner's own site may stay on the free plan.

**Project setup:** an owner-run provisioning script creates the repo from the master starter, installs the GitHub App on it, creates and links the Vercel project (production branch `main`, previews from `staging`), and records the IDs in `projects`. Workers never receive broader credentials.

**Deployment preparation (after report approval):**

1. Production environment variables set by the owner in the client's Vercel project, form mailbox settings (SMTP host, user and password, or Microsoft 365 OAuth details) entered where the PRD calls for a form, analytics only if the PRD asks for it.
2. Production build verified on `staging`; a script strips all cleared claim markers; then `staging` is merged into `main`, which Vercel deploys to production through its Git integration.
3. Domain and DNS handled manually by the owner or the client; the agent produces the exact website DNS records and a step list. Mail records appear only if the PRD names a provider that needs them. Whether to go live on the Vercel address (set to noindex until the custom domain is attached) or wait for the domain is decided per project.
4. Post-deploy smoke test against the live URL, including one real contact-form submission to a test address the owner sets; the owner then switches the recipient to the client's.

**Handover pack (Handover agent drafts, owner approves):**

- A README inside the client's fresh repo: structure, content files, how to run locally, how to test the contact form
- The handover guide (`handover_guide`) and its PDF, shown on the client dashboard, once the owner has approved it, until the retention date: the project documentation, the handover document and a short note on how to ask for changes (during the project through change requests; after close from the owner, outside the pipeline). There is no GitHub web-editor guide
- Ownership transfer checklist: the client creates an empty GitHub repo and adds the owner; an owner-run script first refuses to run while an accepted change request is undeployed, then sets the change-request freeze, then pushes a single clean commit (no round history, no pull requests, no `.pipeline/` notes); the client creates their own Vercel project from the fresh repo, the owner deletes the old project, and environment variables are re-entered from the handover document; domain registrar notes; the documentation states that the client's Vercel project needs the plan Vercel requires for commercial use
- Handover document listing remaining credentials and settings, delivered through the handover guide on the dashboard (manual sharing is no longer required); the credentials in it are erased by the retention job
- Maintenance notes and known limitations

Go-live happens at deployment preparation, and the client sees the final site only once it is live. Change requests apply from go-live until the owner-run transfer script sets the freeze. A project is closed when the owner marks the handover complete, which is refused while an accepted change request is undeployed: the client owns the fresh repo and the Vercel project, while the original repo, its pull requests and the notes file stay with the owner, scoped tokens are revoked, and the project becomes a read-only archive. Uploads and intake data are deleted 90 days after close (adjustable per project), and changes after close are handled outside the pipeline. The owner marks the handover complete; the client is not asked to confirm. That moves the project to stage `closed` with status `closed` and reason `completed` in one step. After that the client dashboard is read-only and shows only the handover guide and its PDF (the database enforces both), and the owner offers a bug-fix window of about 30 days outside the pipeline. A job run at every worker start, on a schedule and from a console button deletes uploads, intake data, run logs and the handover guide's contents and PDF when the retention date arrives and records `data_deleted_at`; client accounts stay until the owner disables them. A final database export runs before close.
