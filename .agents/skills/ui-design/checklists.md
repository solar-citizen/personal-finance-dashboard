# UI Design: Checklists & Review

> Read when reviewing a UI or debugging visual issues.

## Self-Check Before Review

1. **Real app or generic template?** Would this pass for a shipped product?
2. **Squint test.** Squint at a screenshot. Can you still see the structure and the one most important thing?
3. **Comparison test.** Does it hold up next to the best screens already in the app?
4. **Copy check.** Is the text specific, with real labels and numbers?
5. **Consistency check.** Does it feel like the rest of the app?

## Review Checklist

### Generic-AI detection

- [ ] No colors outside the project's tokens (no raw hex, no default palette classes)
- [ ] No gradient blobs, purple/violet gradients or neon
- [ ] Layout has variety (not everything centered, same size or same split)
- [ ] Clear hierarchy (3+ distinct sizes/weights)
- [ ] Copy is specific to the domain

### Quality

- [ ] Whitespace is balanced
- [ ] Accent color is sparing and purposeful
- [ ] Cards/components have some variety (featured vs regular)
- [ ] Hover, focus and active states exist
- [ ] Loading, empty and error states exist

### Consistency

- [ ] Same button hierarchy across screens
- [ ] Same spacing scale throughout
- [ ] Same card/surface styles
- [ ] Max 2 font families, both already loaded

## Troubleshooting: Design vs Implementation Mismatch

| Problem                 | Cause                                   | Fix                                          |
| ----------------------- | --------------------------------------- | -------------------------------------------- |
| Colors are wrong        | Used default palette classes or raw hex | Use semantic tokens from the theme CSS       |
| Spacing is off          | Random padding values                   | Use the Tailwind spacing scale consistently  |
| Fonts look different    | Font not loaded or overridden           | Use the fonts configured via `next/font`     |
| Components look generic | Didn't read existing components         | Read the theme and existing components first |
| Mobile is broken        | Desktop-first, not tested               | Check 375 / 768 / 1440                       |
