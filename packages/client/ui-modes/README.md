# @deepseek-ai/dsh-client-ui-modes

English | [中文](README.zh.md)

Workspace modes for the Saddle Web GUI: the shape of the screen that fits the work, the device, and the moment. A mode is a recipe over layout facts the shell already owns, so the whole feature is data plus an applier — adding a mode is a catalogue entry and its copy, never a code path through the shell. The node half is an empty apply (the roster row).

## What this package owns

**The catalogue** (`src/client/catalogue.ts`): one arrangement per mode id, expressed in the panel shapes `ctx.layout` accepts (`closed` / `default` / `wide`). The width contract stays in `ui-layout`'s columns, so a mode names a shape and the shell decides the pixels.

**Per-device-class memory** (`src/client/store.ts`): the active mode persists under a key scoped by device class — `phone`, `tablet`, `desktop` — so a phone and a laptop may hold different shapes, and a reload restores the shape this device class left rather than the default one.

**The applier** (`src/client/apply.ts`): two writes and no lifecycle. The panels go through `ctx.layout.setPanels` (the columns recompute; the details subtree stays mounted at width 0), and `data-workspace-mode` lands on the root element, which is what `modes-chrome.module.css` keys on. Because nothing mounts or unmounts, a draft, a scroll position, and running work survive a switch.

**Three entrances**: the Modes row in the sidebar footer beside Deployments and Scheduled Tasks; the active-mode chip in the session header, which leaves the mode in one click; and the agent's own tool.

| Mode | Arrangement | For |
| --- | --- | --- |
| `standard` | session list open, details column closed | the shell's own default shape |
| `focus` | session list out, details column wide | one document and one pane |
| `zen` | both panels out, conversation on a 760px reading measure | writing and reading |

## The agent entrance

The agent applies a mode by calling the `set_workspace_mode` tool, which appends the `workspace/mode` event owned by [`@deepseek-ai/dsh-workspace-modes`](../../interaction/workspace-modes/README.md). The host folds that event into the `workspaceMode` session projection (`{ mode, at }`), and the header chip consumes it: an instruction is applied once, by its sequence, so asking for a mode the person has since left still applies while the exit is never undone by the instruction that entered it. A person's own switch writes the store directly and never round-trips through the log.

## Model Experience

Indirectly: this package renders, arranges, and remembers; what the model may do — the tool name, its description, its parameter enum, and the durable record — belongs to `@deepseek-ai/dsh-workspace-modes`. Nothing here adds model-visible text.

#### KV Cache effect

None from this package. A switch rearranges panels and columns only; it does not touch the system prompt or the tool catalog, so no request prefix is invalidated. The catalog is fixed by the session's agent preset, which is why this plugin never adds or removes tools as modes change.

## Known Limitations and Deferred Work

- **One mode at a time.** Modes do not stack; Focus is not yet a sub-state of another mode.
- **A recorded instruction is consumed by the session header.** A mode applied in a session that is not open takes effect when that session is opened.
- **Work modes only.** Play, Share, Morning Briefing, World Builder, and Party / Field Capture from the Pillar B catalogue are not built yet; Play and Share are the next pair, and each is a catalogue entry plus a slot contribution once the mechanism this package proves is in place.
- **No per-workspace or per-session override.** Memory is per device class only.
- **The chip's exit is unconfirmed.** Leaving a mode is a local write, so a failed arrangement surfaces as no change rather than an error; `ctx.layout.setPanels` throws only before the root entry is wired, which cannot happen from a mounted chip.
