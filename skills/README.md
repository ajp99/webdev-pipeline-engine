# Skills library

Reusable SKILL.md files that agents load for specific work. Grouped by area; one folder per skill inside each area.

| Area | For |
| --- | --- |
| `starter-customization/` | Adapting the master starter to a client |
| `industry-copy/` | Writing copy for an industry |
| `seo/` | SEO basics and checks |
| `accessibility-basics/` | Accessibility basics |
| `mdx-content-structure/` | MDX/JSON content layout the client edits |
| `resend-contact-form/` | The Resend contact form route and spam protection |
| `deployment/` | Production deploy and DNS steps |
| `handover/` | Documentation, editor guide, ownership transfer |

## Format

```
skills/<area>/<skill-name>/SKILL.md
```

A SKILL.md has a short front-matter block (`name`, `description`), then Preconditions, Steps, and Decision guidance. Skills must use parameters instead of client-specific names, URLs, colors or paths.

## Lifecycle

Skills move project-local, candidate, library, deprecated (see `docs/spec/06-agents-skills-tools.md`). Only owner-approved skills live here in `skills/`. Project-local skills stay in the client's repo until promoted. `skills_registry` in the database tracks scope, version and approval.

The folders are empty for now; phase 3 (task P3-T01) creates the first skills.
