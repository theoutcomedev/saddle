// @vitest-environment jsdom
/**
 * The header chip is two things at once: the visible answer to "what is this
 * screen arranged for", and the place an agent-applied layout reaches the
 * shell. The second half is why the projection carries a sequence — an
 * instruction to enter a layout the person has since left must still apply, and
 * an instruction already consumed must not fight the exit.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { WorkspaceLayoutId } from '@deepseek-ai/dsh-workspace-modes/client'
import { LayoutChip, type LayoutChipProps } from '../src/client/LayoutChip.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh)

/** A recorded instruction: the layout the session logged, and its sequence. */
interface Instruction { layout: WorkspaceLayoutId; at: number }

function harness(active: WorkspaceLayoutId = 'default') {
  let state = { active, previous: 'default' as WorkspaceLayoutId }
  let projection: Instruction | undefined
  const apply = vi.fn((layout: WorkspaceLayoutId) => { state = { active: layout, previous: state.active } })
  const props = {
    t,
    apply,
    useLayouts: <T,>(selector: (snapshot: typeof state) => T): T => selector(state),
    useProjection: (key: string): Instruction | undefined => key === 'workspaceLayout' ? projection : undefined,
  } as unknown as LayoutChipProps
  return {
    props,
    apply,
    recorded: (value: Instruction | undefined) => { projection = value },
  }
}

describe('LayoutChip', () => {
  it('renders nothing while the default arrangement is in force', () => {
    const view = render(<LayoutChip {...harness('default').props} />)
    expect(view.container.firstChild).toBeNull()
  })

  it('names the active layout and leaves it in one click', () => {
    const h = harness('focus')
    render(<LayoutChip {...h.props} />)
    expect(screen.getByText('专注')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: '退出专注' }))
    expect(h.apply).toHaveBeenCalledWith('default')
  })

  it('applies a recorded instruction, and does not re-apply it', () => {
    const h = harness('default')
    h.recorded({ layout: 'zen', at: 7 })
    const view = render(<LayoutChip {...h.props} />)
    expect(h.apply).toHaveBeenCalledWith('zen')
    view.rerender(<LayoutChip {...h.props} />)
    // Leaving a layout must not be undone by the instruction that entered it.
    expect(h.apply).toHaveBeenCalledTimes(1)
  })

  it('applies the same layout again when it is a new instruction', () => {
    const h = harness('default')
    h.recorded({ layout: 'zen', at: 7 })
    const view = render(<LayoutChip {...h.props} />)
    h.recorded({ layout: 'zen', at: 8 })
    view.rerender(<LayoutChip {...h.props} />)
    expect(h.apply).toHaveBeenCalledTimes(2)
    expect(h.apply).toHaveBeenLastCalledWith('zen')
  })

  it('does nothing while the session records no instruction', () => {
    const h = harness('default')
    render(<LayoutChip {...h.props} />)
    expect(h.apply).not.toHaveBeenCalled()
  })
})
