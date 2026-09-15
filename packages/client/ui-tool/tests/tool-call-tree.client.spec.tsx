// @vitest-environment jsdom
/** ToolCallTree-owned root/subcall markers and selection projection. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { HostDescription } from '@deepseek-ai/dsh-client-connection/client'
import type { ConversationSnapshot, ToolResultNode } from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { ToolTreeProps } from '../src/client/contract/slots.ts'
import { ToolCallTree } from '../src/client/tool/ToolCallTree.tsx'
import { zh } from '@deepseek-ai/dsh-client-ui-conversation/src/client/locales.ts'

afterEach(cleanup)

const t: ToolTreeProps['t'] = makeTranslate(zh, commonZh)

const root = (callId: string, call: ToolResultNode['call']): ToolResultNode => ({
  kind: 'tool-result', seq: 3, time: 3_000, callId, call, callTime: 2_000,
  content: [], isError: false, callView: null, resultView: null, subCalls: [],
})

/** One image content part, branded the way the attachment service hands it over. */
type ContentPart = ToolResultNode['content'][number]

function imagePart(attachmentId: string): ContentPart {
  return {
    type: 'image',
    attachment: { attachmentId, mediaType: 'image/png', bytes: 8, width: 2, height: 2 },
  } as unknown as ContentPart
}

function props(
  block: ToolResultNode,
  selectedCallId?: string,
  description?: HostDescription,
  renderMessageImages: ToolTreeProps['renderMessageImages'] = vi.fn(() => null),
): ToolTreeProps {
  const snapshot = {} as ConversationSnapshot
  const useSession = ((selector: (value: ConversationSnapshot) => unknown) => selector(snapshot)) as ToolTreeProps['useSession']
  const renderSlot = ((_key: string, _owner: object, options?: { fallback?: React.ReactNode }) =>
    options?.fallback ?? null) as unknown as ToolTreeProps['renderSlot']
  return {
    useSession,
    renderSlot,
    node: {
      key: `tool:${block.callId}`,
      kind: 'tool-call',
      id: block.callId,
      target: 'chat',
      anchorSeq: block.seq,
      location: { kind: 'session' },
      visibility: 'visible',
      data: { root: block },
    },
    selectedCallId,
    openFile: vi.fn(),
    inspectCall: vi.fn(),
    forkAt: vi.fn(),
    fileMentions: vi.fn(),
    useHostDescription: (selector => selector(description)) as ToolTreeProps['useHostDescription'],
    renderMessageImages,
    t,
  } as unknown as ToolTreeProps
}

describe('ToolCallTree', () => {
  it('owns the root marker, generic fallback, and selected state for a window-truncated call', () => {
    const block = root('w1', null)
    const view = render(<ToolCallTree {...props(block, 'w1')} />)
    const row = view.container.querySelector('[data-chat-call-id="w1"]')
    expect(row?.getAttribute('data-chat-anchor-key')).toBe('call:w1')
    expect(row?.getAttribute('data-selected')).toBe('true')
    expect(view.container.querySelector('[data-variant="others"]')).not.toBeNull()
    expect(view.getByText('w1')).toBeTruthy()
  })

  it('recursively renders a selected leaf without selecting its ancestors', () => {
    const leaf = root('parent:code:1:code:1', { name: 'read', argsRaw: '{"path":"a.ts"}' })
    const child = {
      ...root('parent:code:1', { name: 'run_code', argsRaw: '{"code":"return 1"}' }),
      subCalls: [leaf],
    }
    const block = {
      ...root('parent', { name: 'run_code', argsRaw: '{"code":"return 1"}' }),
      subCalls: [child],
    }
    const view = render(<ToolCallTree {...props(block, leaf.callId)} />)
    const nests = view.container.querySelectorAll('[data-subcalls]')
    expect(nests[0]?.parentElement).toBe(view.container.querySelector('[data-chat-call-id="parent"]'))
    expect(nests[1]?.parentElement).toBe(view.container.querySelector('[data-chat-call-id="parent:code:1"]'))
    expect(view.container.querySelector('[data-chat-call-id="parent"]')?.hasAttribute('data-selected')).toBe(false)
    expect(view.container.querySelector('[data-chat-call-id="parent:code:1"]')?.hasAttribute('data-selected')).toBe(false)
    expect(view.container.querySelector('[data-chat-call-id="parent:code:1:code:1"]')?.getAttribute('data-selected')).toBe('true')
    expect(nests).toHaveLength(2)
  })

  it('hands a settled result image to the conversation image gallery', () => {
    const renderMessageImages = vi.fn(() => null)
    const image = imagePart('att-1')
    const block = {
      ...root('img1', { name: 'read_image', argsRaw: '{"file_path":"qr.png"}' }),
      content: [{ type: 'text', text: '<path>qr.png</path>' }, image],
    } as ToolResultNode
    render(<ToolCallTree {...props(block, undefined, undefined, renderMessageImages)} />)
    expect(renderMessageImages).toHaveBeenCalledWith({
      images: [{ attachment: (image as { attachment: unknown }).attachment }],
      align: 'start',
    })
  })

  it('renders no gallery for a running call or a picture-free result', () => {
    const running = vi.fn(() => null)
    const runningBlock = {
      callId: 'run1', name: 'read_image', argsRaw: '{"file_path":"qr.png"}',
      turn: 1, step: 0, time: 1_000, callView: null, subCalls: [],
    }
    const first = render(
      <ToolCallTree {...props(runningBlock as unknown as ToolResultNode, undefined, undefined, running)} />,
    )
    first.unmount()
    expect(running).not.toHaveBeenCalled()

    const plain = vi.fn(() => null)
    const textOnly = {
      ...root('r1', { name: 'read', argsRaw: '{}' }),
      content: [{ type: 'text', text: 'no picture here' }],
    } as ToolResultNode
    render(<ToolCallTree {...props(textOnly, undefined, undefined, plain)} />)
    expect(plain).not.toHaveBeenCalled()
  })

  it('leaves a subcall picture to the subcall row instead of repeating it', () => {
    const renderMessageImages = vi.fn(() => null)
    const leaf = {
      ...root('parent:code:1', { name: 'read_image', argsRaw: '{}' }),
      content: [imagePart('att-leaf')],
    } as ToolResultNode
    const block = {
      ...root('parent', { name: 'run_code', argsRaw: '{"code":"return 1"}' }),
      subCalls: [leaf],
    } as ToolResultNode
    render(<ToolCallTree {...props(block, undefined, undefined, renderMessageImages)} />)
    const calls = renderMessageImages.mock.calls as unknown as [{ images: { attachment: { attachmentId: string } }[] }][]
    // Once, for the leaf's own row: the run_code root has no picture of its own.
    expect(renderMessageImages).toHaveBeenCalledTimes(1)
    expect(calls[0]?.[0].images.map(image => image.attachment.attachmentId)).toEqual(['att-leaf'])
  })

  it('abbreviates a POSIX home path in the generic tool summary', () => {
    const block = root('w1', { name: 'read', argsRaw: '{"path":"/h/docs/a.ts"}' })
    const view = render(<ToolCallTree {...props(block, 'w1', {
      version: '0', cwd: '/tmp', attachedSessions: 0, home: '/h', canOpenPath: false,
    })} />)
    expect(view.getByText('~/docs/a.ts')).toBeTruthy()
  })
})
