# @deepseek-ai/dsh-client-ui-modes

English | [中文](README.zh.md)

Workspace layouts for the Saddle Web GUI: the shape of the screen that fits the work, the device, and the moment. A layout is a recipe the shell resolves against what the device can actually do, so the whole feature is data plus an applier — adding one is a catalogue entry and its copy, never a code path through the shell. The node half is an empty apply (the roster row).

## Layout, not mode

The product already has **agent presets** (Standard, Creator, …) — what the assistant may do — and the session header shows one as a pill. These are the other thing: the shape of the screen the assistant works on. Calling both a "mode" put two identically named chips in one header and two rows with the same word in one sidebar, so this feature is a **layout** everywhere it is visible: the sidebar row, the picker title, the chip, the tool, and the session event.

## What this package owns

**The catalogue** (`src/client/catalogue.ts`): nine arrangements, each one a shell specification — where every surface sits (`column` / `sheet` / `none`), how much chrome is left (`full` / `compact`), which composer is shown (`full` / `minimal` / `none`), how much air (`compact` / `comfortable` / `roomy`), and the reading measure. Each entry also names the device classes whose picker offers it, so a phone lists phone jobs rather than a universal list of adjectives. Pixel widths stay in `ui-layout`'s columns: a layout names a shape, the shell decides the pixels.

**Per-device memory** (`src/client/store.ts`): what each device class last showed is remembered per class, and the store follows `ctx.device` instead of reading it once at load. Following is what keeps a resized window honest — a window dragged into a phone's band switches the memory, the picker list, and the shell's placements from the same facts.

**The applier** (`src/client/apply.ts`): one call into `ctx.layout` (`applyShell`) plus `data-workspace-layout` on the root element. The shell resolves the specification against the device, so a layout that asks for a pane on a device that cannot dock one gets the pane as a sheet rather than losing it. Because nothing mounts or unmounts, a draft, a scroll position, and running work survive a switch.

**Three entrances**: the Layout row in the sidebar footer beside Deployments and Scheduled Tasks — on a phone it sits inside the session-list sheet, which is where that device keeps its chrome; the active-layout chip in the session header, which leaves the layout in one click and wears the row's own glyph; and the agent's own tool.

| Layout | Devices | For |
| --- | --- | --- |
| `default` | every class | the shell's own shape: session list open, the pane available and closed |
| `capture` | phone | the composer leads and the session list becomes a page you pull in |
| `read` | phone | the composer is out of the way and the writing takes the screen |
| `focus` | every class | session list out, the pane beside the document |
| `zen` | tablet, laptop, desktop | both side surfaces out, the text held to a reading measure |
| `workbench` | tablet, laptop, desktop | the pane stays beside the work instead of being opened each time |
| `counter` | tablet | showing someone: chrome away, and leaving takes a deliberate move |
| `studio` | laptop, desktop | dense chrome, the pane open wide, the conversation to the side |
| `wall` | desktop | edge to edge, no composer and no navigation |

## The device model

This package asks `ctx.device` (owned by `ui-layout`) what the machine in front of the person is — class, orientation, input, and whether panes can dock — and derives none of those answers from a width of its own. A layout's request is then honoured by placement: `details: 'column'` on a device that cannot dock the pane opens it as a sheet.

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
- **No per-workspace or per-session override.** Memory is per device class only, and a class that has chosen nothing gets the default arrangement.
- **The package is still named `ui-modes`.** The renames that matter are the ones a person reads; the package, its slot ids, and the host package keep their original names to avoid churning every bundle row and tsconfig reference.
- **The chip's exit is unconfirmed.** Leaving a layout is a local write, so a failed arrangement surfaces as no change rather than an error; `ctx.layout.applyShell` throws only before the root entry is wired, which cannot happen from a mounted chip.
