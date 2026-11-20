---
name: mdx-content-structure/pages-and-posts
description: Lay out pages, blog posts and settings as MDX and JSON the client can edit, with schema checks at build.
version: 1
---

# Pages and posts

## Preconditions

- The starter's content folders: `content/pages/`, `content/posts/`, `content/settings.json`, `content/navigation.json`.

## Steps

1. Pages are `content/pages/<slug>.mdx` with front matter: title, description, slug.
2. Blog posts are `content/posts/<yyyy-mm-dd>-<slug>.mdx` with front matter: title, description, date, author, categories, draft.
3. Settings and navigation are JSON and are checked against their schemas at build; an error names the file, the field and what is wrong in plain words.
4. Keep components in MDX to the documented section components, so the client's editor guide stays true.
5. When the PRD has a blog: the index lists posts newest first, drafts are hidden in production, and each category has its own page.

## Decision guidance

- Content belongs in `content/`, not in components.
- Never break the schemas to fit an unusual page: extend the schema and document the new field.
