// @vitest-environment jsdom
/**
 * The sidebar row is the person's entrance: it opens the catalogue and hands
 * the choice back through the injected face. The picker marks the active layout
 * rather than hiding it, so the list stays a map of the shapes available.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { WorkspaceLayoutId } from '@deepseek-ai/dsh-workspace-modes/client'
import { LayoutsButton, type LayoutsButtonProps } from '../src/client/LayoutsButton.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh)

function harness(active: WorkspaceLayoutId = 'default') {
  const state = { active, previous: 'default' as WorkspaceLayoutId }
  const apply = vi.fn()
  const props = {
    t,
    apply,
    wide: true,
    useLayouts: <T,>(selector: (snapshot: typeof state) => T): T => selector(state),
  } as unknown as LayoutsButtonProps
  return { props, apply }
}

describe('LayoutsButton', () => {
  it('opens the catalogue from the sidebar row', () => {
    render(<LayoutsButton {...harness().props} />)
    fireEvent.click(screen.getByRole('button', { name: '布局' }))
    expect(screen.getByRole('dialog', { name: '工作区布局' })).toBeTruthy()
    expect(screen.getByText('默认')).toBeDefined()
    expect(screen.getByText('专注')).toBeDefined()
    expect(screen.getByText('禅写')).toBeDefined()
  })

  it('switches to the chosen layout and closes', () => {
    const h = harness()
    render(<LayoutsButton {...h.props} />)
    fireEvent.click(screen.getByRole('button', { name: '布局' }))
    fireEvent.click(screen.getByRole('button', { name: /禅写/ }))
    expect(h.apply).toHaveBeenCalledWith('zen')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('marks the layout already in force', () => {
    render(<LayoutsButton {...harness('focus').props} />)
    fireEvent.click(screen.getByRole('button', { name: '布局' }))
    expect(screen.getByRole('button', { name: /专注/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /禅写/ }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByText('当前')).toBeDefined()
  })

  it('collapses to a glyph-labelled control on the sidebar rail', () => {
    const h = harness()
    render(<LayoutsButton {...h.props} wide={false} />)
    const trigger = screen.getByRole('button', { name: '布局' })
    expect(trigger.getAttribute('title')).toBe('布局')
    // The rail has room for the glyph alone: the label stays the accessible
    // name rather than a rendered span.
    expect(screen.queryByText('布局')).toBeNull()
  })
})
