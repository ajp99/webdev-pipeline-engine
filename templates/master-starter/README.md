# templates/master-starter

The master site starter that the Prototype and Builder agents copy into each client's repo: static-first Next.js + Tailwind, MDX/JSON content, blog, an SMTP contact form route (generic SMTP, Google Workspace or Gmail app password, Microsoft 365 OAuth 2.0), privacy policy and cookie notice templates, SEO basics.

- This folder is deliberately **outside the pnpm workspaces** (`pnpm-workspace.yaml` covers only `apps/*` and `packages/*`), so its dependencies never mix with the pipeline's.
- Status: a minimal one-page Next.js + Tailwind starter with a lockfile, enough for the walking skeleton (P2-T23); the Builder replaces `app/page.tsx`. The full starter (content, blog, contact form, SEO, privacy templates) is built in phase 3, task P3-T02. Target: Lighthouse 80+ on the starter itself.
- Install with `pnpm install --frozen-lockfile --ignore-scripts` (no install scripts on the host until the Builder container exists, D-286, D-310).

See `docs/spec/00-overview.md` (Site architecture) and `docs/spec/08-qc-and-report.md`.
