# QC and final report

> Originally a snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05). The repo is the source of truth; this file includes the owner-approved decisions D-038 to D-069 recorded in `DECISIONS.md`. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

The QC agent runs after the last build round; a project passes when every item below passes, and failures return to the Builder as a fix list for the owner's approval, with at most 2 fix loops before the report lists what remains for the owner to accept or fix manually.

| Check | Pass bar |
| --- | --- |
| Lighthouse (mobile, key pages) | 80+ in Performance, Accessibility, Best Practices, SEO |
| Basic SEO | Unique title and meta description per page, one H1, sitemap.xml, robots.txt, canonical tags, Open Graph tags, alt text on images |
| Generic checklist | Responsive at common widths, no console errors, no broken links, favicon present, 404 page works, contact form delivers an email, blog posts render, forms validate, privacy policy and cookie notice present and linked, contact form spam protection works as the PRD specifies |
| E2E smoke (Playwright) | Home loads, navigation works on every page, contact form submits, blog index and post open |

If a page misses 80 on a category, the report states the score and cause, and the owner decides whether to fix or accept.

**Final report:** one concise page covering what was built against the PRD, round history, Lighthouse scores, checklist result, accepted deviations, open items, and a deploy-readiness verdict. The owner approves it before deployment preparation starts.
