# @deepseek-ai/dsh-workspace-modes

English | [中文](README.zh.md)

The agent's side of workspace layouts: the `set_workspace_layout` tool, the durable `workspace/layout` event it writes, and the `workspaceLayout` session projection the browser half reads. What a mode looks like — which panels are out, how wide the pane and the reading measure are — belongs to [`@deepseek-ai/dsh-client-ui-modes`](../../client/ui-modes/README.md); this package owns only what the model may ask for and the record of having asked.

A mode is not a setting the agent may hold: it is a request recorded in the session log, one event per call. The persona of the entry is therefore replayable and identical across a reload or a second tab, and the person who is looking at the screen sees the arrangement change as the tool returns.

The projection folds the last request into `{ layout, at }`, where `at` is the recording event's own sequence. The sequence is the whole reason the key exists: two requests for the same mode are two instructions, and a renderer applying by value alone would ignore the second one — so "put me back in zen mode" works after the person has left zen, while the exit is never undone by the instruction that entered it.

## Layout, not mode

An agent preset is what the assistant may do; a layout is the shape of the screen it does it on. The session header shows one of each, so this package and its browser half use "layout" in every name a person or a model can read — the tool, its parameter, the event it appends, and the projection a client folds. The package names (`dsh-workspace-modes`) are the one place the older word survives, because renaming them would churn every bundle row and tsconfig reference for no reader's benefit.

## Model Experience

**Tool.** `set_workspace_layout` takes one required enum parameter over the catalogue (`default`, `focus`, `zen`) and returns one line naming the mode and what it means. The description lists every mode with its purpose, derived from `src/catalogue.ts` so the enum and the prose cannot drift apart.

**Logged state.** One `workspace/layout` event per call, log-only and non-surface: it is not part of the transcript the model reads back, and the model's view of what happened is the tool result alone.

#### KV Cache effect

None. The tool catalog and the system prompt are fixed by the session's agent preset; a mode change writes a session event and nothing else, so no request prefix is invalidated.

## Known Limitations and Deferred Work

- **The catalogue is a build constant.** A deployment cannot add a mode from configuration; adding one means an entry here and in the browser package's catalogue, which a spec in the latter reads together.
- **No removal.** There is no tool to leave a mode: leaving is the person's gesture on the chip, and the model returning to `standard` is the only way it can undo its own request.
- **The arrangement itself is unverified host-side.** The tool records the request; whether the browser could honour it is not observable from the host, and a client that is not running shows the next time it loads.
