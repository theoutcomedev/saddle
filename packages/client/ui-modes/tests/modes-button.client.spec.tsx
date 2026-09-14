// @vitest-environment jsdom
/**
 * The sidebar row is the person's entrance: it opens the catalogue and hands
 * the choice back through the injected face. The picker marks the active mode
 * rather than hiding it, so the list stays a map of the shapes available.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { WorkspaceModeId } from '@deepseek-ai/dsh-workspace-modes/client'
import { ModesButton, type ModesButtonProps } from '../src/client/ModesButton.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh)

function harness(active: WorkspaceModeId = 'standard') {
  const state = { active, previous: 'standard' as WorkspaceModeId }
  const apply = vi.fn()
  const props = {
    t,
    apply,
    wide: true,
    useModes: <T,>(selector: (snapshot: typeof state) => T): T => selector(state),
  } as unknown as ModesButtonProps
  return { props, apply }
}

describe('ModesButton', () => {
  it('opens the catalogue from the sidebar row', () => {
    render(<ModesButton {...harness().props} />)
    fireEvent.click(screen.getByRole('button', { name: '模式' }))
    expect(screen.getByRole('dialog', { name: '工作区模式' })).toBeTruthy()
    expect(screen.getByText('标准模式')).toBeDefined()
    expect(screen.getByText('专注')).toBeDefined()
    expect(screen.getByText('禅写')).toBeDefined()
  })

  it('switches to the chosen mode and closes', () => {
    const h = harness()
    render(<ModesButton {...h.props} />)
    fireEvent.click(screen.getByRole('button', { name: '模式' }))
    fireEvent.click(screen.getByRole('button', { name: /禅写/ }))
    expect(h.apply).toHaveBeenCalledWith('zen')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('marks the mode already in force', () => {
    render(<ModesButton {...harness('focus').props} />)
    fireEvent.click(screen.getByRole('button', { name: '模式' }))
    expect(screen.getByRole('button', { name: /专注/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /禅写/ }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByText('当前')).toBeDefined()
  })

  it('collapses to a glyph-labelled control on the sidebar rail', () => {
    const h = harness()
    render(<ModesButton {...h.props} wide={false} />)
    const trigger = screen.getByRole('button', { name: '模式' })
    expect(trigger.getAttribute('title')).toBe('模式')
    // The rail has room for the glyph alone: the label stays the accessible
    // name rather than a rendered span.
    expect(screen.queryByText('模式')).toBeNull()
  })
})
