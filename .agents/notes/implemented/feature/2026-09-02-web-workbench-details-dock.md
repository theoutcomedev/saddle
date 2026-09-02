# Web Workbench: the details column as a tabbed dock

**Date:** 2026-09-02  **Status:** Implemented (foundation)  **Area:** Web client — ui-worker

## Problem

The right `details` column (the AppFrame's third track) shows only a single session tool-details inspector. We want a Devin-style tabbed dock so it can host several panes (tool details, background jobs, and later file tree / file viewer / browser preview) with closable tabs and an add menu.

## Decision

1. **The Workbench becomes the `details` occupant.** `ui-layout` already *declares* `details`; `ui-conversation` was its occupant. We introduce `@deepseek-ai/dsh-client-ui-workbench` as the new occupant of `details` and re-home the session Details panel under a new child slot `workbench.pane.details`. Re-homing keeps the tool-details inspector verbatim.
2. **Declare the pane slots in `ui-layout`.** `workbench.pane.details` and `workbench.pane.jobs` are `single`, `session`-scoped slots declared in `ui-layout` (which owns `details`), so both the Workbench occupant and a re-homed pane can name the keys without a cross-package dependency cycle. `ui-workbench` occupies `details` and declares those keys as runtime children; `ui-conversation` registers `DetailsPanel` into `workbench.pane.details` (loaded through its existing `ui-layout` type import).
3. **Default view unchanged.** The tab strip is hidden while only the base Details pane is open; it appears once a second pane is added. The base Details pane cannot be closed, so the column always keeps its own close affordance. The Jobs pane is registered read-only (`jobsBySession` mirror).

## Files

- `packages/client/ui-workbench/` (new): Workbench dock, jobs pane, locale, invariant, README, package/tsconfig/tsdown.
- `packages/client/ui-layout/src/client/index.ts`: adds `workbench.pane.details` / `workbench.pane.jobs` to `SlotMap` + `WorkbenchPaneOwnerProps`.
- `packages/client/ui-conversation/src/client/apply.ts`: re-homes `DetailsPanel` from `details` to `workbench.pane.details` via `slots.inject`.
- `packages/client/ui-conversation/src/client/contract/slots.ts`: re-points `DetailsSlotProps` to `'workbench.pane.details'`.
- `packages/bundle/web-app/cordis.patch.yml` + `package.json`, `tsconfig.client.json`: register the new package.
- `packages/client/ui-conversation/tests/chat-apply.client.spec.tsx`: updated for the re-homed slot.

## Deferred

- **Jobs Stop button** — blocked by a model-facing decision: host `kill()` marks terminal delivery *reported*, so a human-cancel would leave the model believing the job is running.
- **Explorer / File panes** — need a new host `@remote` on the FS service (a `TypertRemoteService` with list/read methods) plus the generated api-remotes descriptor and a client `remote.<namespace>` facade; the existing `host.listDirectory` returns directories only.
- **Mobile** — a bottom-sheet / overlay variant over `shell.overlay` / `shell.mobile_trigger`.

## Panes shipped

- **Details** (re-homed tool-details inspector, default, unchanged).
- **Jobs** (read-only `jobsBySession` mirror).
- **Browser** — URL bar + embedded webview (iframe); accepts an initial URL via owner params. URL auto-open is wired app-wide: a delegated document click listener routes any `http(s)` link to the Browser pane and opens the column.

## Test note

`pnpm exec tsc -b tsconfig.client.json` is clean and the `chat-apply` spec passes. The repository-wide `pnpm run test:gui` in this workspace snapshot shows pre-existing failures in `ui-layout` (app-frame / theme-presenter) and jsdom `matchMedia`; those fail identically on the clean baseline, so they are not caused by this change.
