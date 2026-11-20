---
name: starter-customization/apply-brand
description: Apply the client's brand to the master starter: colours, fonts, logo, navigation and site settings.
version: 1
---

# Apply brand

## Preconditions

- The approved plan's design brief (palette, fonts, layout approach) and the PRD's brand section.
- The master starter is checked out in the project working directory.

## Steps

1. Read `content/settings.json` and its schema. Change only values; never rename keys.
2. Set the palette from the design brief in the `--color-*` custom properties at the top of `app/globals.css` (primary, on-primary, ink, muted, surface, line, background). Check text on every background reaches WCAG AA contrast (4.5:1 for body text, 3:1 for large text).
3. Set the fonts from the Google Fonts catalog through `next/font` in `app/fonts.ts`: at most two families, with `display: swap`. Never link a font from a third-party URL.
4. Logo: put the supplied file in `public/` and set `logo` (src and alt) in `content/settings.json`, or the text wordmark when the client has none (D-184).
5. Navigation: write `content/navigation.json` from the PRD site map, in its order. The privacy policy and cookie notice go in the footer, not the main menu.
6. Run the build. Schema errors from the settings check are in plain words: fix the value they name.

## Decision guidance

- When the brief and the brand inputs disagree, follow the brand inputs and note it in the round summary.
- Do not add dark mode, analytics or extra fonts unless the PRD asks.
- Keep motion subtle and respect `prefers-reduced-motion`.
