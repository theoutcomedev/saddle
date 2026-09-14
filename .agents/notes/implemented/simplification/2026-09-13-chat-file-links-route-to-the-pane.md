# Agent Note: Chat file links route to the pane, not the desktop

Status: implemented

English | [中文](2026-09-13-chat-file-links-route-to-the-pane.zh.md)

## Problem

A file path in the conversation — a tool-row summary, a produced-file chip, or a closing-message mention — routed into the Workbench files pane and then asked the Host to hand the same path to the desktop's default application. On a local GUI the second half launches the reader's own editor next to the pane that already shows the file, so one click produced two surfaces. On a containerised or headless host the same call can only fail, which is why the chat view carried an in-page refusal dialog with a retry of the same path. A gesture whose two halves disagree about where the file goes needs a refusal surface to explain the half that cannot work everywhere.

## Decision

`ChatViewInjected.openFile` resolves the path against the session cwd, dispatches `workbench:open-file`, and opens the details column. It does not call `WorkspaceRuntime.openPath`, and it returns nothing to await, so the chat view no longer wraps it. The refusal dialog, its copy (`fileOpen.*`), its styles, its package specs, and its golden snapshot are deleted with the call they reported.

`host.openPath` and its platform adapters are unchanged and stay reachable from the Workbench files pane's own Open control — the gesture that names a file and asks for the desktop, made where the file is shown. The row's path link still stops propagation, so the link and the row's expand toggle remain independent gestures.

## Alternatives considered

**Keep both destinations and let the reader turn the desktop hand-off off.** A preference leaves the default double-open in place, and the setting would have to exist before the annoyance is fixed. The pane already offers the desktop hand-off through an explicit control, so nothing is lost by making the implicit copy go away.

**Keep the refusal dialog for the pane's own Open control.** That control sits next to the file in a pane the reader opened deliberately; a conversation-level modal that survives a view switch is the wrong owner for a local refusal. The pane's control keeps its current silent-failure behavior.

**Route the gesture to the desktop only.** The pane is where the file's contents and its neighbors are, and it is the destination that works on every host shape, including remote and containerised ones. Dropping it would remove the working half to keep the failing one.

**Keep the dialog while removing the call from the chat gesture.** The dialog can only open from a rejection of that call; leaving it wired would be a surface no product path can reach.

## Consequences

A file-path click now has one outcome on every host: the file appears in the Workbench. The local double-open is gone, and a remote or containerised deployment no longer reports an error for a click that succeeded in the pane. What is given up: opening the file in the reader's own application takes the extra gesture of the pane's Open control, and the conversation surface no longer reports a Host refusal at all. Reintroducing a conversation-level desktop hand-off requires the refusal surface to return with it — reason and retry for the same path, and the request-generation guard that keeps a settlement arriving after dismissal from reopening the dialog.

## Related

[Tool-call file open in OS](../../../.agents/notes/implemented/feature/2026-07-28-tool-call-file-open-in-os.md) still owns the path link's rendering and the Host opener itself.
