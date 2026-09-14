// @vitest-environment jsdom
/**
 * Applying a layout is two writes and no lifecycle: the panels go through the
 * layout service's declared action set, and the attribute the layout styles key
 * on lands on the root element. Nothing here mounts or unmounts, which is the
 * property that lets state survive a switch.
 */
import { describe, expect, it, vi } from 'vitest'
import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client'
import { LAYOUT_ATTRIBUTE, applyLayout } from '../src/client/apply.ts'
import { LAYOUT_ARRANGEMENTS } from '../src/client/catalogue.ts'

function fakeLayout(): ILayout {
  return {
    toggleSidebar: vi.fn(),
    openDetails: vi.fn(),
    closeDetails: vi.fn(),
    toggleDetails: vi.fn(),
    setPanels: vi.fn(),
  }
}

describe('applyLayout', () => {
  it('writes the catalogue arrangement through the layout service', () => {
    const layout = fakeLayout()
    applyLayout('zen', layout, document.documentElement)
    expect(layout.setPanels).toHaveBeenCalledWith(LAYOUT_ARRANGEMENTS.zen)
    expect(layout.setPanels).toHaveBeenCalledTimes(1)
  })

  it('names the active layout on the root element for the layout styles', () => {
    applyLayout('focus', fakeLayout(), document.documentElement)
    expect(document.documentElement.getAttribute(LAYOUT_ATTRIBUTE)).toBe('focus')
  })

  it('still arranges the panels with no document to mark', () => {
    // The plugin runs in node-driven client trees too (e2e boots the client
    // tree without a document element of its own).
    const layout = fakeLayout()
    applyLayout('default', layout, null)
    expect(layout.setPanels).toHaveBeenCalledWith(LAYOUT_ARRANGEMENTS.default)
  })
})
