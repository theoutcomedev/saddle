# Agent Note: Creative-theme conformance for the preview card, and the narrow drawer's dismissal

Status: implemented

English | [中文](2026-09-12-creative-theme-conformance-and-narrow-drawer.zh.md)

## Problem

Two surfaces were built to a fixed value instead of to the palette, so only the built-in `light` and `dark` themes read correctly:

1. The sidebar Session/Workspace preview card painted `#2C2C2E` with a `#FFFFFF`/`#CFD3D6`/`#ADB2B8` label ramp from component CSS. In a creative palette the card stayed neutral grey over a themed shell.
2. On a narrow viewport the sidebar is a full-height overlay, but tapping a Session in it left the drawer covering the conversation it had just opened.

## Decision

1. **The preview card is token-driven.** `--dsw-specific-hovercard-bg`, `-label`, `-label-secondary`, and `-label-tertiary` are declared once in `design-platform.css` from existing static neutrals (bluish-850/00/300/400 — the exact former values), deliberately not repeated per scheme, so `light` and `dark` render identically to before. `ui-primitives/HoverCard.module.css` and `ui-workspace/Rows.module.css` consume the tokens through the CSS-module classes they already owned, and neither reads a literal colour any more.
2. **Only the creative palettes override them.** The `HOVER_CARD_TOKENS` group in `ui-theme/src/client/index.ts` points the four names at the palette's own `--dsw-alias-bg-layer-3` and label aliases. It joins `CHAT_CONTENT_TOKENS` in one `CREATIVE_TOKENS` group spread into the six palettes, so a seventh palette inherits the derivation by spreading that group.
3. **The drawer dismissal is a layout policy, not a click handler.** `createLayoutStore` gains `closeSidebar`, which clears `narrowExpanded` and — unlike `toggleSidebar` — never writes the wide width preference. `AppFrame` runs it from a layout effect on the selected Session id, blank Sessions included, which is the same change signal the existing `closeDetails` policy uses.

## Alternatives considered

- **Literal per-palette hex values for the card.** Rejected: four more literals per palette to maintain, and a palette that renames its elevations would silently keep the neutral card.
- **Reusing an existing alias directly (`--dsw-alias-bg-layer-3`) in the component CSS.** Rejected: it would repaint the card in `light` and `dark` too, which the figma card deliberately does not do.
- **Calling the dismissal from each row's open handler.** Rejected: content-search results, the command palette, and the New Session button all open a Session without touching a tree row, so the click site is not the complete set.
- **Reusing `toggleSidebar` for the dismissal.** Rejected: on a narrow viewport it flips the override, so it would re-open an already-collapsed drawer, and on a wide viewport it would close the sidebar column.

## Consequences

- `light` and `dark` keep the figma card byte-for-byte; the six creative palettes repaint it with their own elevations, and their label ramp follows the palette's contrast rather than a fixed white/grey set.
- The card's surface is now a theme token, so a palette author can retarget it by overriding one name.
- Session selection, not the click, is the trigger: tapping the Session that is already current leaves the drawer open.
- `closeSidebar` stays inside the layout store; `ctx.layout`'s public face is unchanged.
- The card's drop shadow still comes from the neutral sheet every palette shares.

## Files

- `packages/client/ui-theme/src/styles/design-platform.css`: the four `--dsw-specific-hovercard-*` tokens.
- `packages/client/ui-theme/src/client/index.ts`: `HOVER_CARD_TOKENS` and the combined `CREATIVE_TOKENS` group.
- `packages/client/ui-primitives/src/HoverCard.module.css`, `packages/client/ui-workspace/src/client/rows/Rows.module.css`: consume the tokens.
- `packages/client/ui-layout/src/client/stores.ts` and `AppFrame.tsx`: `closeSidebar` and its narrow-only effect.
- Tests: `ui-theme/tests/theme.client.spec.ts`, `ui-layout/tests/layout-store.client.spec.ts`, `ui-layout/tests/app-frame.client.spec.tsx`.

## Deferred

- **Gesture-level dismissal.** A per-row callback (the `expandSidebar` owner-prop route) would also cover the already-current Session, at the cost of threading a layout callback through `sidebar.workspaces`.
- **Palette-owned elevation shadows.** The creative palettes name no shadow, so the card keeps the neutral `--dsw-shadow-lv3`.
