// @vitest-environment jsdom
/**
 * The header chip is two things at once: the visible answer to "what is this
 * screen arranged for", and the place an agent-applied mode reaches the shell.
 * The second half is why the projection carries a sequence — an instruction to
 * enter a mode the person has since left must still apply, and an instruction
 * already consumed must not fight the exit.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { WorkspaceModeId } from '@deepseek-ai/dsh-workspace-modes/client'
import { ModeChip, type ModeChipProps } from '../src/client/ModeChip.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh)

/** A recorded instruction: the mode the session logged, and its sequence. */
interface Instruction { mode: WorkspaceModeId; at: number }

function harness(active: WorkspaceModeId = 'standard') {
  let state = { active, previous: 'standard' as WorkspaceModeId }
  let projection: Instruction | undefined
  const apply = vi.fn((mode: WorkspaceModeId) => { state = { active: mode, previous: state.active } })
  const props = {
    t,
    apply,
    useModes: <T,>(selector: (snapshot: typeof state) => T): T => selector(state),
    useProjection: (key: string): Instruction | undefined => key === 'workspaceMode' ? projection : undefined,
  } as unknown as ModeChipProps
  return {
    props,
    apply,
    recorded: (value: Instruction | undefined) => { projection = value },
  }
}

describe('ModeChip', () => {
  it('renders nothing while the plain arrangement is in force', () => {
    const view = render(<ModeChip {...harness('standard').props} />)
    expect(view.container.firstChild).toBeNull()
  })

  it('names the active mode and leaves it in one click', () => {
    const h = harness('focus')
    render(<ModeChip {...h.props} />)
    expect(screen.getByText('专注')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: '退出专注' }))
    expect(h.apply).toHaveBeenCalledWith('standard')
  })

  it('applies a recorded instruction, and does not re-apply it', () => {
    const h = harness('standard')
    h.recorded({ mode: 'zen', at: 7 })
    const view = render(<ModeChip {...h.props} />)
    expect(h.apply).toHaveBeenCalledWith('zen')
    view.rerender(<ModeChip {...h.props} />)
    // Leaving a mode must not be undone by the instruction that entered it.
    expect(h.apply).toHaveBeenCalledTimes(1)
  })

  it('applies the same mode again when it is a new instruction', () => {
    const h = harness('standard')
    h.recorded({ mode: 'zen', at: 7 })
    const view = render(<ModeChip {...h.props} />)
    h.recorded({ mode: 'zen', at: 8 })
    view.rerender(<ModeChip {...h.props} />)
    expect(h.apply).toHaveBeenCalledTimes(2)
    expect(h.apply).toHaveBeenLastCalledWith('zen')
  })

  it('does nothing while the session records no instruction', () => {
    const h = harness('standard')
    render(<ModeChip {...h.props} />)
    expect(h.apply).not.toHaveBeenCalled()
  })
})
