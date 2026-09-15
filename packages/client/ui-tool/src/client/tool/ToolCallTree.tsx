/** Root/subcall Tool composition with one keyed atomic dispatch path. */
import { memo, useMemo, type ReactNode } from 'react'
import type { ToolCallBlock, ToolResultNode } from '@deepseek-ai/dsh-client-runtime/client'
import type { ToolCallOwnerProps, ToolTreeProps } from '../contract/slots.ts'
import { GenericToolCard } from './toolviews/GenericToolCard.tsx'
import css from './ToolCallTree.module.css'

/** Resolve a Tool call's wire name from either lifecycle form. */
function callName(node: ToolCallBlock): string {
  return 'kind' in node ? node.call?.name ?? '' : node.name
}

/** One durable image a settled call carried in its result content. */
type ResultImage = {
  attachment: Extract<ToolResultNode['content'][number], { type: 'image' }>['attachment']
}

/**
 * Every image one settled call carried in its own result content.
 *
 * A Tool that answers with a picture — `read_image`, `browser_screenshot` —
 * writes an image block beside its text so the model can look at the picture on
 * the next request. Those blocks reach the client already; handing them to the
 * conversation's image gallery is what lets the reader see the picture in the
 * conversation too, instead of only the sentence describing it.
 *
 * Only this call's own blocks: a subcall paints its own gallery at its own row,
 * so folding children in here would show the same picture twice.
 * @param block - one root or subcall lifecycle value.
 * @returns the image attachments in source order; empty while still running.
 */
function resultImages(block: ToolCallBlock): readonly ResultImage[] {
  if (!('kind' in block)) return []
  const images: ResultImage[] = []
  for (const part of block.content) {
    if (part.type === 'image') images.push({ attachment: part.attachment })
  }
  return images
}

/** One atomic call dispatched through the Tool-owned keyed slot. */
const ToolCall = memo(function ToolCall({
  renderSlot, callId, toolName, block, openFile, selected, cwd, home, inspectCall, t, children,
  renderMessageImages,
}: Pick<ToolTreeProps, 'renderSlot' | 'openFile' | 'cwd' | 'inspectCall' | 't' | 'renderMessageImages'> & {
  callId: string
  toolName: string
  block: ToolCallBlock
  selected: boolean
  home?: string | undefined
  children?: ReactNode
}) {
  const owner: ToolCallOwnerProps = useMemo(() => ({
    callId,
    toolName,
    block,
    openFile,
    cwd,
    home,
    inspect: () => { inspectCall(callId) },
  }), [callId, toolName, block, openFile, cwd, home, inspectCall])
  const images = useMemo(() => resultImages(block), [block])
  return (
    <div
      className={css.callRow}
      data-chat-anchor-key={`call:${callId}`}
      data-chat-call-id={callId}
      data-selected={selected || undefined}
    >
      {renderSlot('tool.call.toolview', owner, {
        entryKey: toolName,
        fallback: <GenericToolCard {...owner} t={t} />,
      })}
      {/* The call's own pictures, above its children: the gallery is the Tool
          result's visible half, so it stays outside the collapsible row body. */}
      {images.length === 0 ? null : (
        <div className={css.callImages}>
          {renderMessageImages({ images, align: 'start' })}
        </div>
      )}
      {children}
    </div>
  )
})

const ToolCallBranch = memo(function ToolCallBranch({
  renderSlot, block, selectedCallId, cwd, home, openFile, inspectCall, t, renderMessageImages,
}: Pick<ToolTreeProps, 'renderSlot' | 'selectedCallId' | 'cwd' | 'openFile' | 'inspectCall' | 't' | 'renderMessageImages'> & {
  block: ToolCallBlock
  home?: string | undefined
}) {
  return (
    <ToolCall
      renderSlot={renderSlot}
      callId={block.callId}
      toolName={callName(block)}
      block={block}
      openFile={openFile}
      selected={block.callId === selectedCallId}
      cwd={cwd}
      home={home}
      inspectCall={inspectCall}
      renderMessageImages={renderMessageImages}
      t={t}
    >
      {block.subCalls.length > 0 ? (
        <div className={css.subCalls} data-subcalls>
          {block.subCalls.map(child => (
            <ToolCallBranch
              key={child.callId}
              renderSlot={renderSlot}
              block={child}
              selectedCallId={selectedCallId}
              cwd={cwd}
              home={home}
              openFile={openFile}
              inspectCall={inspectCall}
              renderMessageImages={renderMessageImages}
              t={t}
            />
          ))}
        </div>
      ) : null}
    </ToolCall>
  )
})

/**
 * Render one root Tool call and its recursive children through the same
 * atomic keyed dispatch.
 * @param props - whole-Tool owner data and the Tool-owned child-slot share.
 * @returns the Tool call tree.
 */
export function ToolCallTree({
  renderSlot, node, selectedCallId, cwd, openFile, inspectCall, useHostDescription, renderMessageImages, t,
}: ToolTreeProps) {
  const home = useHostDescription(description => description?.home)
  const block = node.data.root
  return (
    <ToolCallBranch
      renderSlot={renderSlot}
      block={block}
      selectedCallId={selectedCallId}
      cwd={cwd}
      home={home}
      openFile={openFile}
      inspectCall={inspectCall}
      renderMessageImages={renderMessageImages}
      t={t}
    />
  )
}
