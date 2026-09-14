# Agent Note: Workspace modes: one mechanism, three entrances, one record

Status: implemented

English | [中文](2026-09-13-workspace-modes.zh.md)

## Problem

The shell had one shape. A person reading a long document, writing one, reviewing an agent's work, or playing something all got the same three columns, and the only way to change it was to drag panels by hand — every session, every device. The deeper problem was architectural: everything that could have been a "mode" (fullscreen canvas, workbench dock, mobile drawer) had been built as its own feature with its own state, so a second shape meant a second mechanism, and a third meant a third.

The agent could not change the shape at all, which is backwards for a product whose premise is that the software rearranges itself around the work.

## Decision

**A mode is data.** The catalogue names an arrangement in the layout service's own vocabulary — `closed` / `default` / `wide` per panel — and the width contract stays in `ui-layout`'s columns. Adding a mode is an entry plus its copy, and the panel numbers never leave the shell: a mode names a shape, not a size.

**Applying one is two writes and no lifecycle.** `ctx.layout.setPanels` arranges the panels (closing writes 0 through the close actions, because the width setters clamp into the open range), and one attribute on the root element — `data-workspace-mode` — carries the mode for styles. The details subtree already stays mounted at width 0, and nothing here mounts or unmounts anything, which is what makes "switching costs no state" a fact rather than a hope.

**Memory is per device class.** The active mode persists under a store scope key of `phone` / `tablet` / `desktop`, so a reload restores the shape that device class left, and a phone and a laptop may disagree.

**Three entrances, one face.** The Modes row in the sidebar footer (beside Deployments and Scheduled Tasks), the active-mode chip in the session header whose exit is one click, and the model's `set_workspace_mode` tool. All three call the same injected `apply`.

**The agent's entrance is a log event, not a setting.** `@deepseek-ai/dsh-workspace-modes` owns the tool and the `workspace/mode` event; the host folds it into a `workspaceMode` session projection carrying `{ mode, at }`, where `at` is the recording event's sequence. The chip consumes each instruction once, by sequence: two requests for the same mode are two instructions ("put me back in zen mode" works after an exit), while an instruction already consumed can never undo the person's exit. A person's own switch writes the store directly and never round-trips through the log.

**The agent may apply a mode itself** — not only on an explicit request. Four rails hold in the same change: it always names what it applied (tool result plus the chip), the exit is one click and is never undone by the entering instruction, a switch costs no state, and an instruction recorded in a session nobody is looking at takes effect when that session is opened.

## Alternatives considered

**A mode as a component tree per shape.** The obvious first implementation — a "zen" component that renders its own chrome — would have made every mode a parallel shell, and the third mode would have inherited two mechanisms to keep in step. The recipe form keeps one shell and one arrangement step.

**Modes as a browser-only preference.** Storing the mode client-side only would have left the agent unable to change it at all, and made the record of "who changed my screen" unrecoverable. The event is in the log, the client is a consumer of it.

**The agent restricted to suggesting.** Rejected by the product owner: the agent may switch. The rails above are what make that safe — an unnamed rearrangement, or one that costs state, is the failure this decision had to avoid.

**Driving the arrangement from a mode-owned CSS class instead of the layout store.** CSS cannot close a grid track that the concession solver owns, and a second geometry authority would have fought the existing one on every resize. The mode writes through the same actions the drag handles use.

**A pre-change snapshot for undo.** Reverting to a remembered shape would have made "leave this mode" mean "restore whatever was there", which is wrong for a mode whose exit is also its definition of standard; the plain mode is the shell's own default shape.

## Consequences

The shell now has a shape vocabulary instead of one layout: three modes ship (standard, focus, zen), and the next ones are catalogue entries rather than features. The arrangement survives a reload per device class, and the agent can change it — with the record in the session log, so a replay, a second tab, and a cold read agree.

What is given up: a draft mode cannot change the shell's content (all three rearrange panels and measure), modes do not stack, and Focus is not yet a sub-state of another mode; leaving a mode restores the shell default rather than a remembered arrangement; and a mode's arrangement is not verified host-side, so a client that is not running applies the pending request the next time it loads.

## Related

[Pillar B workspace fitness](../../../saddle-context/docs/saddle_pillar_b_workspace_fitness.md) owns the design and the remaining build order (Play, Share, Morning Briefing, World Builder).
