---
name: ui-design
description: Use when building or restyling UI (pages, components, dashboards). Be creative within the project's existing design system - reuse its tokens, shadcn/ui components and fonts, never invent new ones; max 2 font families per app. Avoids generic AI-looking design.
---

# UI Design

The design system is fixed. Creativity goes into composition, hierarchy, rhythm and detail, not into new colors or fonts.

## 1. Read the system first

Before writing UI, check:

- theme/global CSS (Tailwind v4 tokens, CSS variables) and the web app's CLAUDE.md
- existing components and installed shadcn/ui primitives
- fonts already loaded via `next/font`

Use semantic tokens (`bg-background`, `text-muted-foreground`), never raw hex or default palette classes like `bg-blue-500`. Reuse a shadcn/ui component before building one. If a token or component is truly missing, say so and propose it; don't invent it silently.

## 2. Fonts

- Never swap or add fonts in an app that already has them.
- If none are set: max 2 families in the whole app (UI/body + optionally one for headings). Pick legible over default-looking, and use tabular numerals for money and figures.

## 3. Where creativity goes

- Hierarchy: one big, bold element per section; strong size/weight contrast
- Layout: whitespace over decoration; vary card sizes (featured vs regular); break the grid occasionally; don't center everything
- Accent color sparingly (about 10-15% of the screen)
- Motion: a few intentional moments (staggered page load, hover/focus feedback), CSS-first, respect `prefers-reduced-motion`
- Copy: specific, real labels and numbers; no marketing fluff

## 4. Avoid generic AI patterns

- Purple/violet gradients, neon, gradient blobs behind text
- Identical rounded cards in a three-column icon grid
- Every section as a 50/50 image + text split
- Icons on everything; one font size everywhere
- Buttons without clear primary/secondary/ghost hierarchy

## 5. Process

Tokens -> base components -> composites -> screens -> states (loading, empty, error) -> responsive (375 / 768 / 1440).

## 6. Quality bar

Real content (no lorem ipsum, no placeholder images), all states visible, hover/focus styles, readable contrast, nothing breaks at any viewport.
