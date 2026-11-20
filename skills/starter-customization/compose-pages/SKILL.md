---
name: starter-customization/compose-pages
description: Build the pages in a round's scope from the starter's section components and MDX.
version: 1
---

# Compose pages

## Preconditions

- The round scope (pages and features) and the PRD site map.
- The starter's section components: hero, features, testimonials, FAQ, call to action, contact.

## Steps

1. For each page in scope, create `content/pages/<slug>.mdx` with its front matter (title, description, slug).
2. Compose the page from section components in the order the PRD gives its purpose: lead with what the visitor came for, end with one clear call to action.
3. Pass copy as props or MDX text; never hard-code copy inside a component.
4. Reuse components before writing new ones. A new section component goes in `components/sections/`, takes props only, and works from 360 px wide.
5. Use the placeholder image component for missing images, with descriptive alt text, until the client supplies photos.
6. Run the build and look at each page at mobile and desktop width.

## Decision guidance

- One primary call to action per page.
- If a page in scope has no content in the PRD or the intake, draft it and list it as a question for the owner.
- Do not build pages outside the round's scope.
