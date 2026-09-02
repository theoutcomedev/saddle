# @deepseek-ai/dsh-client-ui-workbench

English | [中文](README.zh.md)

Web workbench feature owner: turns the right `details` column into a tabbed dock. It becomes the occupant of the `details` slot (declared by [`dsh-client-ui-layout`](../ui-layout/README.md)) and re-homes the session Details panel under a `workbench.pane.details` child slot, so the existing tool-details inspector (Summary / Payload / Result / Schema / Timing) is preserved verbatim as the base tab.

To keep the default view visually unchanged, the tab strip is hidden while only the base Details pane is open; it appears once a second pane is added. The only extra chrome in the default state is a subtle floating `+` (bottom-right) that reveals the add menu. The base Details pane cannot be closed, so the column always keeps one pane (and therefore its own close affordance from the Details panel).

Pane kinds are declared in `ui-layout` (which owns the `details` slot), so both the Workbench occupant and a re-homed pane can name the keys without a cross-package dependency cycle. The background-job pane contributes into `workbench.pane.jobs` (read-only `jobsBySession` mirror) and the browser pane into `workbench.pane.browser` (a URL bar plus an embedded webview that accepts an initial URL through its owner params).

## Model Experience

None: the Workbench renders host-computed session pane state (job mirror, tool-details selection) for a human. It touches no prompt, message, schema, stream, or tool result.

#### KV Cache effect

None; the package never assembles or sends provider requests.

## Known Limitations and Deferred Work

- **The Jobs pane is read-only.** A human-initiated cancellation (a Stop button) is deferred: the host `kill()` marks terminal delivery as *reported*, so an interrupt written against the current contract would leave the model believing the job is still running. Cancellation needs a model-facing decision before it can be surfaced as a control.
- **Explorer (file tree) and File (view) panes are not yet built** — they need new host list-tree / read-file RPCs through the api gateway.
- **URL auto-open is wired but app-wide.** The Workbench registers a delegated document click listener that routes any `http(s)` link to the Browser pane (and opens the column), so a URL surfaced anywhere opens here by default. This intercepts links app-wide; refine with an opt-out for links that should open in a new tab if that becomes undesirable.
- **The embedded webview is an iframe**, so a site sending `X-Frame-Options` / CSP `frame-ancestors` refuses to render; a real (CDP-driven) browser is deferred.
- **Mobile is not yet addressed.** The dock reuses the desktop `details` column; a bottom-sheet / full-screen overlay variant over the existing `shell.overlay` / `shell.mobile_trigger` slots is deferred.
