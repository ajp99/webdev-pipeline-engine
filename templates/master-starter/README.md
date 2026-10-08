# templates/master-starter

The master site starter that the Prototype and Builder agents copy into each client's repo: static-first Next.js + Tailwind, MDX/JSON content, blog, an SMTP contact form route (generic SMTP, Google Workspace or Gmail app password, Microsoft 365 OAuth 2.0), privacy policy and cookie notice templates, SEO basics.

- This folder is deliberately **outside the pnpm workspaces** (`pnpm-workspace.yaml` covers only `apps/*` and `packages/*`), so its dependencies never mix with the pipeline's.
- Status: empty. Built in phase 3, task P3-T02. Target: Lighthouse 80+ on the starter itself.

See `docs/spec/00-overview.md` (Site architecture) and `docs/spec/08-qc-and-report.md`.
