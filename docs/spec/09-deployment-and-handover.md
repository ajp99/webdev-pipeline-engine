# Deployment and handover

> Snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (as of 2026-10-05). From this commit the repo is the source of truth. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

The site is hosted under the owner's accounts during the project, then ownership moves to the client at handover. Vercel's free plan is non-commercial as far as the spec author knows, so hosting client sites under the owner's account needs a paid Vercel plan; verify this before the pilot.

**Deployment preparation (after report approval):**

1. Production environment variables set, Resend sender configured, analytics only if the PRD asks for it.
2. Production build verified, preview promoted to production on a Vercel project.
3. Domain and DNS handled manually by the owner or the client; the agent produces the exact DNS records and a step list.
4. Post-deploy smoke test against the live URL.

**Handover pack (Handover agent drafts, owner approves):**

- Project documentation: structure, content files, how to run locally
- GitHub web-editor guide: how to edit MDX/JSON content, add a blog post, and commit, with screenshots for this project's file layout
- Ownership transfer checklist: GitHub repo, Vercel project, Resend account or sender, domain registrar notes
- Handover document listing remaining credentials and settings, shared manually by WhatsApp or email
- Maintenance notes and known limitations

Go-live happens at deployment preparation, and the client sees the final site only once it is live. Change requests apply from go-live until the owner marks the handover complete. A project is closed when the owner marks the handover complete: ownership of the repo and Vercel project is with the client, scoped tokens are revoked, and the project becomes a read-only archive. Uploads and intake data are deleted 90 days after close (adjustable per project), and changes after close are handled outside the pipeline.
