# @deepseek-ai/dsh-client-ui-modes

English | [中文](README.zh.md)

Workspace layouts for the Saddle Web GUI: the shape of the screen that fits the work, the device, and the moment. A layout is a recipe over layout facts the shell already owns, so the whole feature is data plus an applier — adding one is a catalogue entry and its copy, never a code path through the shell. The node half is an empty apply (the roster row).

## Layout, not mode

The product already has **agent presets** (Standard, Creator, …) — what the assistant may do — and the session header shows one as a pill. These are the other thing: the shape of the screen the assistant works on. Calling both a "mode" put two identically named chips in one header and two rows with the same word in one sidebar, so this feature is a **layout** everywhere it is visible: the sidebar row, the picker title, the chip, the tool, and the session event.

## What this package owns

**The catalogue** (`src/client/catalogue.ts`): one arrangement per layout id, expressed in the panel shapes `ctx.layout` accepts (`closed` / `default` / `wide`). The width contract stays in `ui-layout`'s columns, so a layout names a shape and the shell decides the pixels.

**Per-device-class memory** (`src/client/store.ts`): the active layout persists under a key scoped by device class — `phone`, `tablet`, `desktop` — so a phone and a laptop may hold different shapes, and a reload restores the shape this device class left rather than the default one.

**The applier** (`src/client/apply.ts`): two writes and no lifecycle. The panels go through `ctx.layout.setPanels` (the columns recompute; the details subtree stays mounted at width 0), and `data-workspace-layout` lands on the root element, which is what `layouts-chrome.module.css` keys on. Because nothing mounts or unmounts, a draft, a scroll position, and running work survive a switch.

**Three entrances**: the Layout row in the sidebar footer beside Deployments and Scheduled Tasks; the active-layout chip in the session header, which leaves the layout in one click and wears the row's own glyph; and the agent's own tool.

| Layout | Arrangement | For |
| --- | --- | --- |
| `default` | session list open, details column closed | the shell's own shape |
| `focus` | session list out, details column wide | one document and one pane |
| `zen` | both panels out, conversation on a 760px reading measure | writing and reading |

## The agent entrance

The agent applies a layout by calling the `set_workspace_layout` tool, which appends the `workspace/layout` event owned by [`@deepseek-ai/dsh-workspace-modes`](../../interaction/workspace-modes/README.md). The host folds that event into the `workspaceLayout` session projection (`{ layout, at }`), and the header chip consumes it: an instruction is applied once, by its sequence, so asking for a layout the person has since left still applies while the exit is never undone by the instruction that entered it. A person's own switch writes the store directly and never round-trips through the log.

## Model Experience

Indirectly: this package renders, arranges, and remembers; what the model may do — the tool name, its description, its parameter enum, and the durable record — belongs to `@deepseek-ai/dsh-workspace-modes`. Nothing here adds model-visible text.

#### KV Cache effect

None from this package. A switch rearranges panels and columns only; it does not touch the system prompt or the tool catalog, so no request prefix is invalidated. The catalog is fixed by the session's agent preset, which is why this plugin never adds or removes tools as layouts change.

## Known Limitations and Deferred Work

- **One layout at a time.** Layouts do not stack; Focus is not yet a sub-state of another layout.
- **A recorded instruction is consumed by the session header.** A layout applied in a session that is not open takes effect when that session is opened.
- **Work layouts only.** Play, Share, Morning Briefing, World Builder, and Party / Field Capture from the Pillar B catalogue are not built yet; Play and Share are the next pair, and each is a catalogue entry plus a slot contribution once the mechanism this package proves is in place.
- **No per-workspace or per-session override.** Memory is per device class only.
- **The package is still named `ui-modes`.** The renames that matter are the ones a person reads; the package, its slot ids, and the host package keep their original names to avoid churning every bundle row and tsconfig reference.
- **The chip's exit is unconfirmed.** Leaving a layout is a local write, so a failed arrangement surfaces as no change rather than an error; `ctx.layout.setPanels` throws only before the root entry is wired, which cannot happen from a mounted chip.
