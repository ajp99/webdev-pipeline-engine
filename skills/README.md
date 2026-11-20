# Skills library

Reusable SKILL.md files that agents load for specific work. Grouped by area; one folder per skill inside each area.

| Area | For |
| --- | --- |
| `starter-customization/` | Adapting the master starter to a client |
| `industry-copy/` | Writing copy for an industry |
| `seo/` | SEO basics and checks |
| `accessibility-basics/` | Accessibility basics |
| `mdx-content-structure/` | MDX/JSON content layout the client edits |
| `smtp-contact-form/` | The SMTP contact form route, transports and spam protection |
| `deployment/` | Production deploy and DNS steps |
| `handover/` | Documentation, editor guide, ownership transfer |

## Format

```
skills/<area>/<skill-name>/SKILL.md
```

A SKILL.md starts with a front-matter block between `---` lines: `name` (the id, `<area>/<skill-name>`, equal to the folder), `description` (one line: what it is for) and `version` (a whole number; raise it when the steps change). The body has three sections: `## Preconditions`, `## Steps` and `## Decision guidance`. Skills use parameters, never a client's names, URLs, colours or paths. `packages/shared/src/skills.ts` checks the format; a bad file stops the worker's skill scan with its problem.

## Registry and loading (P3-T01, D-282)

The worker scans `skills/` at start and before every run and brings `skills_registry` in step: a new skill is added as a library skill, a changed version is updated, and a skill whose file is gone is marked deprecated. The Planner selects skills per project by id; a run loads only those, and only if the registry lists them as library skills (`apps/worker/src/skills.ts`).

## Lifecycle

The promotion lifecycle (project-local, candidate, library, deprecated; see `docs/spec/06-agents-skills-tools.md`) is deferred until at least two projects have good marks (D-282). Until then every skill here is a library skill, reviewed by the owner before it is merged.
