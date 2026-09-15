# Agent Note: Web Workbench: the details column as a tabbed dock

Status: implemented

## Problem

The right `details` column (the AppFrame's third track) shows only a single session tool-details inspector. The column is one surface asked to host several kinds of content — tool details, background jobs, files, a browser preview — and a single-inspector occupant leaves no room for a second pane.

## Decision

1. **The Workbench becomes the `details` occupant.** `ui-layout` already *declares* `details`; `ui-conversation` was its occupant. We introduce `@deepseek-ai/dsh-client-ui-workbench` as the new occupant of `details` and re-home the session Details panel under a new child slot `workbench.pane.details`. Re-homing keeps the tool-details inspector verbatim.
2. **Declare the pane slots in `ui-layout`.** `workbench.pane.details` and `workbench.pane.jobs` are `single`, `session`-scoped slots declared in `ui-layout` (which owns `details`), so both the Workbench occupant and a re-homed pane can name the keys without a cross-package dependency cycle. `ui-workbench` occupies `details` and declares those keys as runtime children; `ui-conversation` registers `DetailsPanel` into `workbench.pane.details` (loaded through its existing `ui-layout` type import).
3. **Default view unchanged.** The tab strip is hidden while only the base Details pane is open; it appears once a second pane is added. The base Details pane cannot be closed, so the column always keeps its own close affordance. The Jobs pane is registered read-only (`jobsBySession` mirror).

## Alternatives considered

- **Keeping the tool-details inspector as the `details` occupant and adding tabs inside `ui-conversation`.** Not taken: re-homing the panel under `workbench.pane.details` keeps the inspector verbatim and leaves exactly one package owning the `details` column (Decision 1).
- **Declaring `workbench.pane.*` inside `ui-workbench`.** Not taken: `ui-layout` owns `details`, so declaring the keys there lets both the occupant and a re-homed pane name them without a cross-package dependency cycle (Decision 2).
- **An always-visible tab strip.** Not taken: the base Details pane cannot be closed, so the strip stays hidden until a second pane opens and the default column keeps its current shape (Decision 3).

## Consequences

- The tool-details inspector keeps its exact presentation while moving to a child slot, and `ui-conversation` no longer occupies `details`.
- A new pane is an ordinary slot registration into a key `ui-layout` already declares, so it needs no dependency on the Workbench package.
- The column's default appearance is unchanged until a second pane opens: the tab strip is not part of the base shell.
- Pane growth is bounded by host capability rather than by the dock — file browsing waited on a new host `@remote` (see Deferred).

## Files

- `packages/client/ui-workbench/` (new): Workbench dock, jobs pane, locale, invariant, README, package/tsconfig/tsdown.
- `packages/client/ui-layout/src/client/index.ts`: adds `workbench.pane.details` / `workbench.pane.jobs` to `SlotMap` + `WorkbenchPaneOwnerProps`.
- `packages/client/ui-conversation/src/client/apply.ts`: re-homes `DetailsPanel` from `details` to `workbench.pane.details` via `slots.inject`.
- `packages/client/ui-conversation/src/client/contract/slots.ts`: re-points `DetailsSlotProps` to `'workbench.pane.details'`.
- `packages/bundle/web-app/cordis.patch.yml` + `package.json`, `tsconfig.client.json`: register the new package.
- `packages/client/ui-conversation/tests/chat-apply.client.spec.tsx`: updated for the re-homed slot.

## Panes shipped

- **Details** (re-homed tool-details inspector, default, unchanged).
- **Jobs** (read-only `jobsBySession` mirror).
- **Browser** — URL bar + embedded webview (iframe); accepts an initial URL via owner params. URL auto-open is wired app-wide: a delegated document click listener routes any `http(s)` link to the Browser pane and opens the column.

## Deferred

- **Jobs Stop button** — blocked by a model-facing decision: host `kill()` marks terminal delivery *reported*, so a human-cancel would leave the model believing the job is running.
- **Explorer / File panes** — need a new host `@remote` on the FS service (a `TypertRemoteService` with list/read methods) plus the generated api-remotes descriptor and a client `remote.<namespace>` facade; the existing `host.listDirectory` returns directories only.
- **Mobile** — a bottom-sheet / overlay variant over `shell.overlay` / `shell.mobile_trigger`.

## Testing

`pnpm exec tsc -b tsconfig.client.json` is clean and the `chat-apply` spec passes. The repository-wide `pnpm run test:gui` in this workspace snapshot shows pre-existing failures in `ui-layout` (app-frame / theme-presenter) and jsdom `matchMedia`; those fail identically on the clean baseline, so they are not caused by this change.
