// @vitest-environment jsdom
/**
 * The layout store: panel widths the person drags, the shell specification the
 * active layout writes, and the device facts the browser publishes. The three
 * are different owners on purpose — a store that remembered a crossed breakpoint
 * is what made the shell disagree with itself.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLayoutStore } from '../src/client/stores.ts'
import { classifyDevice } from '../src/client/device.ts'
import { DEFAULT_SHELL, type ShellSpec } from '../src/client/shell.ts'
import { DETAILS_DEFAULT, DETAILS_WIDE, SIDEBAR_DEFAULT } from '../src/client/columns.ts'

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
  window.innerWidth = 1440
  window.innerHeight = 900
})

describe('the layout store', () => {
  it('starts at the default shape on the device it was created on', () => {
    const store = createLayoutStore().create()
    expect(store.getSnapshot().sidebar).toBe(SIDEBAR_DEFAULT)
    expect(store.getSnapshot().details).toBe(0)
    expect(store.getSnapshot().shell).toEqual(DEFAULT_SHELL)
    expect(store.getSnapshot().device.class).toBe('laptop')
  })

  it('clamps a drag into the panel range and never crosses the open line', () => {
    const store = createLayoutStore().create()
    store.actions.setSidebar(10)
    expect(store.getSnapshot().sidebar).toBe(264)
    store.actions.setDetails(10)
    expect(store.getSnapshot().details).toBe(300)
  })

  it('toggles a column on a docking device and a sheet on a sheet device', () => {
    const store = createLayoutStore().create()
    store.actions.toggleSidebar(false)
    expect(store.getSnapshot().sidebar).toBe(0)
    store.actions.toggleSidebar(false)
    expect(store.getSnapshot().sidebar).toBe(SIDEBAR_DEFAULT)

    store.actions.toggleSidebar(true)
    expect(store.getSnapshot().sidebarSheetOpen).toBe(true)
    store.actions.toggleSidebar(true)
    expect(store.getSnapshot().sidebarSheetOpen).toBe(false)
  })

  it('closes both forms in one action, because "not showing" is one state', () => {
    const store = createLayoutStore().create()
    store.actions.openSidebarSheet()
    store.actions.closeSidebar()
    expect(store.getSnapshot().sidebar).toBe(0)
    expect(store.getSnapshot().sidebarSheetOpen).toBe(false)
  })

  it('applying a layout writes the specification and the openness it implies', () => {
    const store = createLayoutStore().create()
    const zen: ShellSpec = { ...DEFAULT_SHELL, sidebar: 'none', details: 'none', composer: 'none' }
    store.actions.setShell(zen)
    expect(store.getSnapshot().shell).toEqual(zen)
    expect(store.getSnapshot().sidebar).toBe(0)
    expect(store.getSnapshot().details).toBe(0)

    const focus: ShellSpec = { ...DEFAULT_SHELL, details: 'column', detailsShown: true, detailsWidth: 'wide' }
    store.actions.setShell(focus)
    expect(store.getSnapshot().details).toBe(DETAILS_WIDE)

    const workbench: ShellSpec = { ...DEFAULT_SHELL, details: 'column', detailsShown: true, detailsWidth: 'default' }
    store.actions.setShell(workbench)
    expect(store.getSnapshot().details).toBe(DETAILS_DEFAULT)
  })

  it('keeps the device facts as the device controller reports them', () => {
    const store = createLayoutStore().create()
    const phone = classifyDevice(390, 844, true)
    store.actions.setDevice(phone)
    expect(store.getSnapshot().device).toEqual(phone)
    const before = store.getSnapshot().device
    store.actions.setDevice({ ...phone })
    expect(store.getSnapshot().device).toBe(before)
  })
})
