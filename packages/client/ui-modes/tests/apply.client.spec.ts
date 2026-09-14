// @vitest-environment jsdom
/**
 * Applying a layout is one call into the shell's layout service plus the
 * attribute that names it. Nothing here touches a width or a breakpoint: the
 * service stores the specification and the frame resolves it against the device,
 * which is what lets a request be honoured by placement instead of dropped.
 */
import { describe, expect, it, vi } from 'vitest'
import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client'
import { LAYOUT_ATTRIBUTE, applyLayout } from '../src/client/apply.ts'
import { LAYOUTS } from '../src/client/catalogue.ts'

function fakeLayout(): ILayout {
  return {
    toggleSidebar: vi.fn(),
    openDetails: vi.fn(),
    closeDetails: vi.fn(),
    toggleDetails: vi.fn(),
    applyShell: vi.fn(),
  }
}

describe('applyLayout', () => {
  it('writes the catalogue specification through the layout service', () => {
    const layout = fakeLayout()
    applyLayout('zen', layout, document.documentElement)
    expect(layout.applyShell).toHaveBeenCalledWith(LAYOUTS.zen.spec)
    expect(layout.applyShell).toHaveBeenCalledTimes(1)
  })

  it('names the active layout on the root element', () => {
    applyLayout('focus', fakeLayout(), document.documentElement)
    expect(document.documentElement.getAttribute(LAYOUT_ATTRIBUTE)).toBe('focus')
  })

  it('still applies with no document to mark', () => {
    const layout = fakeLayout()
    applyLayout('default', layout, null)
    expect(layout.applyShell).toHaveBeenCalledWith(LAYOUTS.default.spec)
  })

  it('applies every layout the catalogue holds', () => {
    for (const id of Object.keys(LAYOUTS) as (keyof typeof LAYOUTS)[]) {
      const layout = fakeLayout()
      applyLayout(id, layout, null)
      expect(layout.applyShell).toHaveBeenCalledWith(LAYOUTS[id].spec)
    }
  })
})
