# QC and final report

> Originally a snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05). The repo is the source of truth; this file reflects the owner-approved decisions recorded in `DECISIONS.md`. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

The QC agent runs after the last build round; a project passes when every item below passes, and failures become a fix list the owner approves, the Builder commits the fixes directly to `staging`, and there are at most 2 fix loops before the report lists what remains for the owner to accept or fix manually.

| Check | Pass bar |
| --- | --- |
| Lighthouse (mobile, on the key pages listed in the approved plan, on a local production build served by the worker) | 80+ in Performance, Accessibility, Best Practices, SEO |
| Basic SEO | Unique title and meta description per page, one H1, sitemap.xml, robots.txt, canonical tags, Open Graph tags, alt text on images |
| Generic checklist | Responsive at common widths, no console errors, no broken links, favicon present, 404 page works, contact form works against a stubbed mail transport (it validates, submits and returns success), blog posts render, forms validate, privacy policy and cookie notice present and linked, contact form spam protection works as the PRD specifies |
| Claim markers | Every `<Claim>` marker in the content belongs to a claim the owner cleared by approving a round |
| E2E smoke (Playwright) | Home loads, navigation works on every page, contact form submits (stubbed transport), blog index and post open |

If a page misses 80 on a category, the report states the score and cause, and the owner decides whether to fix or accept.

**Final report:** one concise page covering what was built against the PRD, round history, Lighthouse scores, checklist result, accepted deviations, open items, and a deploy-readiness verdict. The owner approves it before deployment preparation starts.
**Final screenshots:** after the owner accepts the QC results and report, the worker takes new full-page desktop and mobile screenshots of the finished site (from the local build) and shares them with the client. The client can view them and send comments, which come to the owner as notes; approval stays with the owner, and no email is sent.
