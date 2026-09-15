# Agent Note: Tool results show their images in the conversation

Status: implemented

English | [中文](2026-09-15-tool-result-images-in-the-conversation.zh.md)

## Problem

A Tool that answers with a picture — `read_image`, `browser_screenshot` — already
reached the client carrying it. The call's `ToolResultNode.content` holds the very
`image` block the model reads on the next request (the local `tool/code-dispatch`
event projects it for a subcall; a direct call puts it on the root result), so
nothing had to be fetched, decoded, or re-derived to show it.

Nothing rendered it. The conversation's image gallery serves *message* content:
`AssistantMarkdown` renders `kind: 'image'` assistant blocks through
`renderMessageImages`, and `MessageItem` does the same for user images. A Tool
call never asked. The Chat node renderer already receives `renderMessageImages`
on its owner currency, but the atomic call row's own owner (`ToolCallOwnerProps`)
carries no image loader at all, so the built-in Tool views had no way to draw one.

The reader therefore saw a sentence describing a picture — "Screenshot captured
(visual image attached to this turn)" — and no picture, in a conversation that
had the bytes the whole time.

## Decision

`ToolCallTree` renders the images in a settled call's own result content through
the existing `conversation.message.images` gallery, below that call's row and
above its subcalls.

- `resultImages(block)` collects `{ attachment }` from the call's `content`
  blocks whose `type` is `image`, and returns nothing while the call is still
  running (a `RunningToolCall` has no content).
- `ToolCall` paints them with `renderMessageImages({ images, align: 'start' })`,
  the same slot-backed renderer the assistant and user paths use, so the picture
  gets the real `MessageImage` sizing and the shared `ImageLightbox` without
  ui-tool importing an attachment implementation.
- `renderMessageImages` is threaded from the node entry down through
  `ToolCallBranch` to each `ToolCall`, including recursive subcalls.

Only a call's **own** blocks are rendered. A subcall paints its own gallery at its
own row, so folding children into a parent would show one picture twice.

## Alternatives considered

**Why not hand the Tool row its own image loader?** `ToolCallOwnerProps` is the
atomic view's contract; adding a loader there would create a second image
contract in the client beside `conversation.message.images`, which exists for
exactly this case — its own type documents `RenderMessageImages` as the
"slot-backed renderer used by chat nodes without importing an attachment
implementation".

**Why not promote Tool images into assistant message content server-side?** The
assistant content path is where the gallery already works, so surfacing them
there is tempting. It also changes what the model reads back in history and
touches durable log content for what is a presentation need.

**Why not render only for an explicit allow-list of tools?** The image block is
the tool's own declaration that it answered with a picture; a name list would
drift from the tools that actually emit one.

## Consequences

Every image-bearing Tool result now paints in the transcript, including
`browser_screenshot` and `read_image` inside `run_code` subcalls. That is the
intent, and it is also the cost: a Tool called in a loop repaints each capture
into the flow, where before the transcript stayed text-only and a reader opened
the Browser pane or the file to look.

The plugin-spliced copy of the same image — the harness also admits it as a
next-step `user/message` with `source.kind: 'plugin'` — still renders text-only.
That copy becomes a context-injection row, whose body follows the
producer-declared form rather than the message image path, so the envelope text
(`<path>…</path>`) shows without the picture beside it. It is redundant now that
the Tool row paints, and it is left as-is rather than taught a second image path.

## Testing

`packages/client/ui-tool/tests/tool-call-tree.client.spec.tsx` pins all three
answers: a settled image reaches the gallery with its attachment and `start`
alignment; a running call and a picture-free result render no gallery; and a
subcall's picture renders once, at the subcall row, not repeated on its parent —
the case that caught the first implementation's recursion.
