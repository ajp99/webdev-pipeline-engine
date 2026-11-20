# templates/master-starter

The master site starter that the Prototype and Builder agents copy into each client's repo: static-first Next.js + Tailwind, MDX/JSON content, blog, an SMTP contact form route (generic SMTP, Google Workspace or Gmail app password, Microsoft 365 OAuth 2.0), privacy policy and cookie notice templates, SEO basics.

- This folder is deliberately **outside the pnpm workspaces** (`pnpm-workspace.yaml` covers only `apps/*` and `packages/*`), so its dependencies never mix with the pipeline's.
- Status: the full starter (P3-T02). Layout:
  - `content/settings.json` and `content/navigation.json` (checked at build against `lib/schemas.ts`; errors name the file and field in plain words), `content/pages/*.mdx` (front matter: title, description), `content/posts/<yyyy-mm-dd>-<slug>.mdx` (title, description, date, author, categories, draft).
  - Section components in `components/sections/` (Hero, Features, Testimonials, Faq, CallToAction, ContactSection), plus `Claim` (a factual claim the client confirms; renders normally), `Placeholder` (a marked stand-in image with alt text), `BusinessName` and `ContactEmail`, all usable in MDX.
  - The blog (`/blog`, posts, category pages; drafts hidden in production), privacy policy and cookie notice templates, `sitemap.xml`, `robots.txt`, per-page metadata with Open Graph and Twitter tags, and JSON-LD for the business from the settings (`lib/seo.ts`).
  - The contact form (`components/ContactForm.tsx`, `app/api/contact/route.ts`, `lib/contact.ts`, `lib/mail.ts`): honeypot, minimum fill time and a best-effort rate limit on every form; SMTP (generic, Google Workspace, Gmail app password) or Microsoft 365 OAuth 2.0, set by environment variables only (`.env.example`); a stub transport for tests and previews; a failure screen with the phone number and contact links; Turnstile only when the settings carry a site key.
  - Fonts from Google Fonts through `next/font` (`app/fonts.ts`), downloaded at build and served from the site's own domain; subtle motion that respects reduced-motion; no dark mode and no analytics.
  - Weekly Dependabot pull requests (`.github/dependabot.yml`).
- Checks: `pnpm test` (content schemas, contact form, mail transports, SEO), `pnpm check:content`, `pnpm build`; CI also runs Lighthouse and requires 80+ in every category (`scripts/lighthouse-check.mjs`).
- Install with `pnpm install --frozen-lockfile --ignore-scripts --ignore-workspace` (no install scripts on the host until the Builder container exists, D-286, D-310).

See `docs/spec/00-overview.md` (Site architecture) and `docs/spec/08-qc-and-report.md`.
