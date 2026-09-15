# Agent Note: The light palette's preview card follows the light shell

Status: implemented

English | [中文](2026-09-14-light-palette-hover-card-surface.zh.md)

## Problem

Hovering a Session or Workspace row in the sidebar opens a floating preview card. Under the built-in `light` theme that card painted the figma dark neutrals — a `#2C2C2E` surface with a white/grey label ramp — over a white shell, so the one floating surface a light shell shows carried inverted colours. The built-in `dark` theme and every creative palette read correctly, which left `light` as the only palette whose card ignored the shell.

## Decision

The four `--dsw-specific-hovercard-*` tokens are answered separately by each built-in palette in `design-platform.css`. The `body` rule (light) derives them from that palette's own elevation and label aliases — `--dsw-alias-bg-layer-3` for the surface and the three `--dsw-alias-label-*` rungs for the ramp — and the `body[data-ds-dark-theme]` rule pins the figma neutral ramp (bluish-850/00/300/400, the exact former values). `HOVER_CARD_TOKENS` in `ui-theme/src/client/index.ts` keeps overriding all four names for the creative palettes, so the card tracks a palette's elevations wherever the palette names them and keeps the figma ramp where the dark palette deliberately does not.

`packages/client/ui-theme/tests/hover-card-styles.client.spec.ts` pins both answers against the sheet text and rejects a palette that names three of the four tokens, since the unnamed one would inherit the other palette's value.

## Alternatives considered

- **Keep the figma neutral card under `light`.** Rejected: the card is the only chrome surface that ignores the light palette — menus, tips, code surfaces, and the sidebar itself all derive from it — and the reported symptom is exactly that mismatch.
- **Derive the card in both built-in palettes and drop the figma ramp.** Rejected: it repaints the `dark` card, which reads correctly as it stands and was not part of the defect; a dark-palette change belongs in its own decision rather than riding this one.
- **Put `HOVER_CARD_TOKENS` on the built-in `light`/`dark` theme definitions instead of the sheet.** Rejected: both built-ins carry an empty token map and the light palette is the un-attributed `body` default, so this would make the light card the only one whose colour depends on the presenter having applied a theme, and it would strand the dark palette's figma ramp without an owner.
- **Scoping the alias derivation to a sidebar-only override.** Rejected: the card is portaled to `document.body` and inherits palette variables from there, so a scoped override would have to be re-declared on the portal host — the palette is already the right owner.

## Consequences

- Under `light` the card is the light surface with the palette's own ramp, matching the menus it floats over.
- `dark` and the six creative palettes are unchanged, including the shared neutral `--dsw-shadow-lv3` the card still paints ([the creative-theme note](../feature/2026-09-12-creative-theme-conformance-and-narrow-drawer.md) owns that deferral).
- A theme that switches color scheme now flips the card with it, because both palettes name every one of the four tokens.

## Files

- `packages/client/ui-theme/src/styles/design-platform.css`: the per-palette `--dsw-specific-hovercard-*` declarations.
- `packages/client/ui-theme/src/client/index.ts`: the `HOVER_CARD_TOKENS` doc comment.
- `packages/client/ui-theme/tests/hover-card-styles.client.spec.ts`: the palette contract.
- `packages/client/ui-primitives/src/HoverCard.module.css`, `packages/client/ui-workspace/src/client/rows/Rows.module.css`, and the `ui-primitives`/`ui-theme` READMEs: the comments and prose that stated the former answers.

## Verification

`pnpm exec vitest run packages/client/ui-theme packages/client/ui-primitives packages/client/ui-workspace` covers the palette contract alongside the existing client suites. The reported defect was re-checked in a real browser against the running Web GUI at 1600×900: a Session-row hover under each built-in palette produced a 244px card with surface `rgb(255, 255, 255)` and title `rgb(15, 17, 21)` for `light`, and the unchanged `rgb(44, 44, 46)` surface with a `rgb(255, 255, 255)` title for `dark`.
