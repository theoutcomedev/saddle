# Agent Note: Workspace layouts: one mechanism, nine shapes, one record

Status: implemented

English | [中文](2026-09-13-workspace-modes.zh.md)

## Problem

The shell had one shape. A person reading a long document, writing one, reviewing an agent's work, or playing something all got the same three columns, and the only way to change it was to drag panels by hand — every session, every device. The deeper problem was architectural: everything that could have been a "mode" (fullscreen canvas, workbench dock, mobile drawer) had been built as its own feature with its own state, so a second shape meant a second mechanism, and a third meant a third.

The agent could not change the shape at all, which is backwards for a product whose premise is that the software rearranges itself around the work. And the shapes that did exist could not be true on a phone: they moved panel widths, and a phone has no panel widths to move.

## Decision

**A layout is data.** A catalogue entry is a `ShellSpec` — where each surface sits (`column` / `sheet` / `none`), whether it is on screen, the pane's width rung, header chrome, composer shape, density, and the reading measure — plus the device classes whose picker offers it. Adding a layout is an entry and its copy, never a code path through the shell, and pixel widths stay in `ui-layout`'s columns: a layout names a shape, not a size. Nine ship: `default` and `focus` for every class, `capture` and `read` for a phone, `zen` and `workbench` for tablet through desktop, `counter` for a tablet, `studio` for laptop and desktop, `wall` for a desktop.

**The device decides what can be true; the shell never drops the request.** `ctx.device` (ui-layout) classifies the window by its shortest side — `phone`, `tablet` (touch only), `laptop`, `desktop` — with input as a separate axis, and publishes class, input profile and whether panes can dock as `data-device`, `data-input` and `data-panes` on the root element. `resolveShell` resolves a specification against those facts before anything renders: `column` on a device that cannot dock the pane becomes a `sheet` over the work, and where a layout asks for the pane beside the work and the columns cannot hold both, the session list gives way to its rail before the pane gives way to a sheet. The stored widths are never rewritten by either move, so widening restores the person's own geometry. This is the rule the feature exists to hold: a layout is a claim about what the person should be looking at, and the shell must make it true.

**Applying one is one call and no lifecycle.** `ctx.layout.applyShell(spec)` writes the specification and the openness it implies, and one attribute on the root element — `data-workspace-layout` — carries the layout for styles. The details subtree already stays mounted at width 0, and nothing here mounts or unmounts anything, which is what makes "switching costs no state" a fact rather than a hope.

**Memory is per device class, and the class is followed.** What each class last showed is remembered per class inside the store's own state, so a phone and a laptop may disagree and a reload restores that class's shape. The store follows `ctx.device` rather than reading it once at load: a window dragged into a phone's band switches the remembered layout and the picker's list from the same facts that switch the shell's placements.

**Three entrances, one face.** The Layout row in the sidebar footer (beside Deployments and Scheduled Tasks; inside the session-list sheet on a device that has no sidebar column), the active-layout chip in the session header whose exit is one click, and the agent's `set_workspace_layout` tool. All three call the same injected `apply`.

**The agent's entrance is a log event, not a setting.** `@deepseek-ai/dsh-workspace-modes` owns the tool and the `workspace/layout` event; the host folds it into a `workspaceLayout` session projection carrying `{ layout, at }`, where `at` is the recording event's sequence. The chip consumes each instruction once, by sequence: two requests for the same layout are two instructions ("put me back in Zen Writer" works after an exit), while an instruction already consumed can never undo the person's exit. A person's own switch writes the store directly and never round-trips through the log.

**A removal is not a refusal.** A layout may take a surface away, and a person's gesture still gets it: an explicit open overrides `none`, which is why clicking a file in a writing layout opens the pane instead of doing nothing.

**The vocabulary is layout, not mode.** The product already calls an agent preset a mode — what the assistant may do — and the header showed one as a pill. Naming this the same thing put two identically named chips in one header and two rows sharing a word in one sidebar, which is a naming defect a person cannot work around. Everything visible says **layout**: the sidebar row, the picker title, the chip, the tool (`set_workspace_layout`), the session event (`workspace/layout`), and the projection (`workspaceLayout`); the plain layout is `default` rather than `standard`, so the word that collided with the Standard preset is gone. Package names stay as they shipped — the renames that matter are the ones a person reads.

**The agent may apply a layout itself** — not only on an explicit request. Four rails hold in the same change: it always names what it applied (tool result plus the chip), the exit is one click and is never undone by the entering instruction, a switch costs no state, and an instruction recorded in a session nobody is looking at takes effect when that session is opened.

## Alternatives considered

**A layout as a component tree per shape.** The obvious first implementation — a "zen" component that renders its own chrome — would have made every layout a parallel shell, and the third would have inherited two mechanisms to keep in step. The specification form keeps one shell and one resolution step.

**Keeping the width arithmetic and giving each device its own breakpoints.** Fourteen CSS breakpoints and five JavaScript thresholds were already disagreeing about what a phone is (768 against 1024), so a layout could not ask a question the shell could answer. One classification, published as attributes, is what let the layouts mean something on a phone.

**A device-specific specification per device class within one layout.** Every layout would then carry a spec per class, and the catalogue would grow as classes × layouts while nothing kept the variants coherent. One spec plus a resolver that substitutes placement is smaller and keeps the honesty rule in one place.

**Dropping a requested surface instead of substituting it.** The pre-change behavior — the pane simply did not open on a phone or a tablet in portrait — is what made a working layout look broken. Substitution (a sheet over the work) is the same mechanism in both directions: a request the shell cannot render as asked is still a request to see it.

**A layout as a browser-only preference.** Storing it client-side only would have left the agent unable to change it at all, and made the record of "who changed my screen" unrecoverable. The event is in the log, the client is a consumer of it.

**The agent restricted to suggesting.** Rejected by the product owner: the agent may switch. The rails above are what make that safe — an unnamed rearrangement, or one that costs state, is the failure this decision had to avoid.

**Calling both concepts a mode.** The design brief calls these modes, so the first build did too, and the shipped header then showed "Standard mode" (the preset) beside "Standard mode" (the layout) as two chips a reader could not tell apart. Renaming the concept was cheaper than annotating it.

**Driving the arrangement from a layout-owned CSS class instead of the layout store.** CSS cannot close a grid track that the concession solver owns, and a second geometry authority would have fought the existing one on every resize. A layout writes the specification through the service; the drag handles keep writing geometry through the same store.

**A pre-change snapshot for undo.** Reverting to a remembered shape would have made "leave this layout" mean "restore whatever was there", which is wrong for a layout whose exit is also its definition of plain; the plain layout is the shell's own default shape.

## Consequences

The shell has a shape vocabulary instead of one arrangement: nine layouts ship, each offered only on the devices whose job it is, and the next ones are catalogue entries rather than features. Which surfaces exist, where they sit, how much chrome is left, what the composer looks like, how much air there is and how wide the text runs are all data. On a phone the difference is now visible (Capture keeps the composer and pulls the session list over the work; Read removes the composer until asked), and on a tablet in landscape the pane docks beside the work instead of silently refusing to open. The arrangement survives a reload per device class, and the agent can change it — with the record in the session log, so a replay, a second tab, and a cold read agree.

Sixteen `max-width` blocks in the shell's stylesheets, the sidebar auto-collapse threshold, and the four remaining JavaScript width tests were deleted by this change, and the shell's device answers live in one place that CSS, click handlers and layouts all read.

What is given up: layouts do not stack, and Focus is not yet a sub-state of another; a layout has one specification for every device class it is offered on, so `workbench` on a tablet and on a desktop differ only through the resolver; a device class that has chosen nothing gets the plain layout rather than inheriting another class's choice; leaving a layout restores the shell default rather than a remembered arrangement; and a layout's arrangement is not verified host-side, so a client that is not running applies the pending request the next time it loads.

## Related

[Pillar B device axis](../../../saddle-context/docs/saddle_pillar_b_device_axis.md) records the measurement this work started from and what is still open; [Pillar B workspace fitness](../../../saddle-context/docs/saddle_pillar_b_workspace_fitness.md) owns the design and the remaining build order (Play, Share, Morning Briefing, World Builder).
