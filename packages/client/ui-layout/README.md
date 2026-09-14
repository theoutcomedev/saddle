# @deepseek-ai/dsh-client-ui-layout

English | [中文](README.zh.md)

Shell plugin: the three-column AppFrame (drag handles and concession chain), the `ctx.layout` panel-geometry service, and `ctx.device` — what the browser says about the machine in front of the person. It registers into the runtime-owned `root` slot and declares `sidebar`, `conversation`, `details`, `shell.overlay`, and `shell.mobile_trigger`. The sidebar resize boundary is an invisible hit strip, while the details boundary retains its floating pill; only details shrinks during concession and then auto-closes. A closed sidebar retains a 56px control rail while details closes to zero width. The package also seats the theme presenter: it consumes resolved `ctx.theme` snapshots and projects them onto the document (`html { color-scheme }` for native UA chrome, `body[data-ds-dark-theme]` from the active color scheme, the theme's alias tokens as inline variables on body, and one owned `<meta name="theme-color">` whose content follows the computed body background). Measuring after palette and token application keeps the rendered background as the single color authority; disposing the presenter removes its metadata node with its other global writes.

**The device model** classifies the viewport by its shortest side — `phone`, `tablet`, `laptop`, `desktop` — and keeps input as a separate axis, so a 1366px tablet in landscape is laptop-sized and still has no pointer. Class, orientation, input, and whether a pane can dock beside the work are published on the root element as `data-device`, `data-input`, and `data-panes`, and `ctx.device` follows the window: components and click handlers read those answers instead of deriving a breakpoint of their own.

**Resolution** (`resolveShell`) turns what a layout asks for into what actually renders: a request is never dropped, it is substituted — `column` on a device that cannot dock the pane becomes a `sheet` over the work — and where a layout asks for the pane beside the work but the columns cannot hold both, the session list gives way to its rail before the pane gives way to a sheet. The stored panel widths are never rewritten by either move, so a wider window restores the person's own geometry.

AppFrame always mounts the conversation and details columns; a connected Session renders through `SessionProvider`. The transient layout store starts the sidebar at its default width and details closed, and it never reads or writes `localStorage`. Hero and other unselected states also derive a zero rendered details width without changing that stored preference. AppFrame retains the last non-blank Session id across those states: the first Session remains closed, an explicit details action opens the contract default width, returning to the same Session restores its unchanged width, and selecting a different Session closes details before paint and dismisses the sheet the selection was made from (a sheet, unlike the wide column, is an overlay over the conversation it replaces; the width preference survives). Where the device cannot dock a surface, the sidebar and the details pane render as overlay sheets instead of grid tracks, and the frame element publishes `data-panes`, `data-density`, and `data-details-open` for shell-level styles. The conversation owner share carries the active layout's chrome (`detailsOpen`, `composer`, `header`, `density`, `measure`), and the sidebar owner share carries `collapsed`, `width`, and `sheet`; registrants obtain business data from standard hooks and actions from their own inject faces.

The `/client` exports are the plugin body (`apply`/`inject`), `LayoutController`, `DeviceController`, the owner-share interfaces, and the device and shell contracts other plugins resolve against (`ShellSpec`, `resolveShell`, `DeviceFacts`, `classifyDevice`, `panesAreSheets`, the three published attribute names). AppFrame, the panel store, the concession solver, and the theme presenter remain package-internal.

## Model Experience

None, as the layout shell manages browser viewing state; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Panel geometry is transient** — reload restores the sidebar default and details closed; switching between distinct Session ids also closes details and forgets its dragged width, while unselected surfaces render details at zero width without modifying geometry.
- **Concession-chain auto-close derives a zero width without touching the preferred width** — the panel restores itself when the window widens; consumers must not read the stored details width as the rendered truth.
- **Resolution may rail the session list** — a layout that asks for the pane beside the work renders the navigation as its 56px rail where both cannot fit, and a drag afterwards is the person's answer rather than a new rule.
- **No scroll anchoring during squeeze reflow** — layout changes may move the reader's viewport.
