# Agent Note: A scheduled task is editable, and pins the model its runs use

Status: implemented

English | [中文](2026-09-15-scheduled-task-editing-and-model-pin.zh.md)

## Problem

The Scheduled Tasks Orchestrator could create a task, pause and resume it,
trigger it, read its run history and delete it — but not edit one. Changing a
prompt, a name or a cadence meant deleting the task and building it again, which
also threw away its run history and its last-run state.

Half of the wiring for editing already existed. `schedules.update` has accepted
`name`, `prompt`, `cadenceType`, `cadenceValue`, `targetMode` and `enabled`
since it was written, and the client store used exactly one of them: `enabled`,
for the Pause/Resume toggle. The remaining fields were reachable only by calling
the wire directly.

Choosing the model was absent from the whole path. A task's run dispatches an
agent turn into its target session and inherited whatever route that session
resolved — the run had no way to say "use this model", in either the request, the
stored view, or the dispatch.

## Decision

**The wire carries an optional route.** `ScheduledTaskView`, `schedules.create`
and `schedules.update` each gained an optional `provider` and `model` pair, with
matching zod fields on the view, create and update schemas.

**The host stores it and the run honours it.** `api-proxy` persists the trimmed
pair on create, and on update treats an omitted field as "keep the stored value"
while an explicitly empty one clears the pin. `executeTaskRun` pins the agent it
just resolved before dispatching the prompt:

```ts
selectionFor(turn.agent).current = { provider: task.provider, model: task.model }
```

A task with no pin skips that line entirely and inherits the session's own
selection, which is exactly what every existing task already did.

**The form serves both modes.** One form creates and edits; an Edit action on the
card opens it prefilled from the stored task, and the store's `updateTask` sends
the edited fields and repaints from the host's list rather than from an
optimistic copy.

**The model picker reads the host catalog.** `ScheduledTasksStore.listModels`
projects `llm.models` groups into flat provider/model options — the
session-independent catalog, because a `new-session` task has no session yet when
it is edited. The default option is "Session default (resolve per run)", which is
the unchanged behavior.

**An untouched cadence is not sent.** The form expresses `interval` and `cron`;
a stored task can hold `once`, which the form cannot represent. The cadence
fields join the update payload only once the reader touches a cadence control, so
saving an unrelated edit — a prompt, a model — cannot silently rewrite a one-shot
task into a recurring one.

## Alternatives considered

**Why not store the model on the session the task dispatches into?** A pin has to
belong to the task. In `new-session` mode every run mints a fresh session id, so
a selection written onto one run's session would not be there for the next.

**Why not resolve the pin at create time and store the resolved route?** The
catalog is advisory and the provider directory changes under a long-lived task;
storing the reader's chosen pair keeps the stored value honest about what was
asked for, and a route whose adapter is gone fails the run the same way a
session's own selection would (`model-unavailable`).

**Why not send the whole form on save?** That is what makes a `once` task
unrepresentable — see the cadence decision above.

**Why not a separate endpoint for the model?** Editing is one user act. A second
endpoint would leave the task half-updated between two calls that can fail
independently.

## Consequences

A task can now be corrected in place, keeping its history, its last-run state and
its id, and a run can be pinned to a model instead of inheriting whatever the
target session happens to resolve.

Stored tasks are unaffected and need no migration: both fields are optional, and
absent means the previous behavior. The JSON store at `~/.dsh/schedules.json`
holds whatever was written plus the optional pair.

The picker shows what the host advertises. When a provider's catalog lookup
fails, its models are simply absent from the list — the surface can offer fewer
routes than are runnable, which is why "Session default" stays the default rather
than a catalog entry.

## Testing

`packages/client/ui-settings-general/tests/schedules-store.client.spec.ts` pins
the store's edit path: every field rides the wire (including a cleared pin), a
successful edit refreshes from the host's list, a refusal surfaces the host's
message and refreshes nothing, and the catalog projects to provider/model pairs
(or an empty list) without throwing. The same package's modal test keeps its
overlay-containment answer with the catalog call stubbed.
