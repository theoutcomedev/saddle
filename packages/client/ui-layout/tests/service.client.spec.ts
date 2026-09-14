// @vitest-environment jsdom
/**
 * The two cross-plugin faces: ctx.layout (panel transitions plus the one call a
 * layout makes) and ctx.device (what the browser says). Geometry lives in the
 * store spec — here the contract is delegation, the unwired fail-loud, the
 * re-attach overwrite, and the attributes the device publishes.
 */
import { describe, expect, it, vi } from 'vitest'
import { DeviceController, LayoutController } from '@deepseek-ai/dsh-client-ui-layout/src/client/service.ts'
import type { PanelActions } from '@deepseek-ai/dsh-client-ui-layout/src/client/service.ts'
import { DEFAULT_SHELL } from '@deepseek-ai/dsh-client-ui-layout/src/client/shell.ts'

function fakePanels(): PanelActions {
  return {
    setSidebar: vi.fn(),
    setDetails: vi.fn(),
    toggleSidebar: vi.fn(),
    closeSidebar: vi.fn(),
    openSidebarSheet: vi.fn(),
    closeSidebarSheet: vi.fn(),
    setDevice: vi.fn(),
    setShell: vi.fn(),
    openDetails: vi.fn(),
    closeDetails: vi.fn(),
    toggleDetails: vi.fn(),
  }
}

describe('LayoutController', () => {
  it('forwards the pane transitions to the attached set', () => {
    const service = new LayoutController()
    const panels = fakePanels()
    service.attachPanels(panels)
    service.openDetails()
    service.closeDetails()
    service.toggleDetails()
    expect(panels.openDetails).toHaveBeenCalledTimes(1)
    expect(panels.closeDetails).toHaveBeenCalledTimes(1)
    expect(panels.toggleDetails).toHaveBeenCalledTimes(1)
  })

  it('asks the published device answer which form the sidebar toggle takes', () => {
    document.documentElement.setAttribute('data-panes', 'sheet')
    try {
      const service = new LayoutController()
      const panels = fakePanels()
      service.attachPanels(panels)
      service.toggleSidebar()
      expect(panels.toggleSidebar).toHaveBeenCalledWith(true)
    } finally {
      document.documentElement.removeAttribute('data-panes')
    }
  })

  it('applies a shell specification in one call', () => {
    const service = new LayoutController()
    const panels = fakePanels()
    service.attachPanels(panels)
    service.applyShell(DEFAULT_SHELL)
    expect(panels.setShell).toHaveBeenCalledWith(DEFAULT_SHELL)
  })

  it('fails loud before the root entry wired its actions', () => {
    const service = new LayoutController()
    expect(() => { service.openDetails() }).toThrow(/panel actions not wired/)
    expect(() => { service.applyShell(DEFAULT_SHELL) }).toThrow(/panel actions not wired/)
  })

  it('re-attach overwrites the stale action set (entry re-register)', () => {
    const service = new LayoutController()
    const stale = fakePanels()
    const fresh = fakePanels()
    service.attachPanels(stale)
    service.attachPanels(fresh)
    service.closeDetails()
    expect(stale.closeDetails).not.toHaveBeenCalled()
    expect(fresh.closeDetails).toHaveBeenCalledTimes(1)
  })
})

describe('DeviceController', () => {
  it('classifies the window it starts in and publishes the answer', () => {
    window.innerWidth = 390
    window.innerHeight = 844
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }))
    const root = document.createElement('div')
    const device = new DeviceController(root)
    expect(device.facts().class).toBe('phone')
    expect(root.getAttribute('data-device')).toBe('phone')
    expect(root.getAttribute('data-panes')).toBe('sheet')
  })

  it('hands the same facts to the store through the wiring hook', () => {
    const root = document.createElement('div')
    const device = new DeviceController(root)
    const setFacts = vi.fn()
    device.attachStore(setFacts)
    expect(setFacts).toHaveBeenCalledWith(device.facts())
  })

  it('reads the window it is constructed in, marking the root element', () => {
    window.innerWidth = 1440
    window.innerHeight = 900
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
    const root = document.createElement('div')
    const device = new DeviceController(root)
    expect(device.facts().sheetPanes).toBe(false)
    expect(root.getAttribute('data-panes')).toBe('dock')
  })

  it('tells its followers about a change, and stops when they leave', () => {
    window.innerWidth = 1440
    window.innerHeight = 900
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
    const device = new DeviceController(document.createElement('div'))
    const seen: string[] = []
    const unwatch = device.watch((facts) => { seen.push(facts.class) })
    const stop = device.start()
    window.innerWidth = 390
    window.innerHeight = 844
    window.dispatchEvent(new Event('resize'))
    expect(seen).toEqual(['phone'])
    unwatch()
    window.innerWidth = 1440
    window.dispatchEvent(new Event('resize'))
    expect(seen).toEqual(['phone'])
    stop()
  })

  it('starts and stops watching without a window', () => {
    const device = new DeviceController(null)
    const stop = device.start()
    expect(typeof stop).toBe('function')
    stop()
  })
})
