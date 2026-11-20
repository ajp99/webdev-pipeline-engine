---
name: accessibility-basics/page-checks
description: Check each built page against the accessibility basics before the round summary.
version: 1
---

# Page checks

## Preconditions

- The round's pages build and run locally.

## Steps

1. Landmarks: one `header`, `nav`, `main` and `footer`; a skip link to `main`.
2. Headings in order with one `h1`.
3. Every image has alt text (empty only when it is purely decorative); every form field has a visible label.
4. Contrast reaches WCAG AA; focus is visible on every interactive element; nothing is reachable only by hover.
5. Motion respects `prefers-reduced-motion`; nothing flashes.
6. Run Lighthouse's accessibility audit on each page; fix anything under 90 and note what is left in the round summary.

## Decision guidance

- Prefer native elements (button, a, details) over custom widgets.
- Never remove focus outlines without a visible replacement.
