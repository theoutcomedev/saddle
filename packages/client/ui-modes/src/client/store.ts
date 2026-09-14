/**
 * Per-device-class layout memory. A phone and a laptop are allowed to want
 * different shapes, so the remembered layout is keyed by device class: the
 * store's own scope key, which `defineStore` appends to its persist name.
 * Nothing else about a layout is stored — the arrangement is derived from the
 * catalogue, so a recipe change reaches every device on its next load.
 */
import { defineStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceLayoutId } from '@deepseek-ai/dsh-workspace-modes/client'
import { DEFAULT_LAYOUT } from './catalogue.ts'

/** The device classes a layout is remembered for. */
export type DeviceClass = 'phone' | 'tablet' | 'desktop'

/**
 * Classify a viewport the way the shell already branches: the sidebar
 * auto-collapse breakpoint separates a phone from a tablet, and the details
 * drawer's widest useful rung separates a tablet from a desktop.
 * @param viewportWidth - the window's inner width in px.
 * @returns the device class that width belongs to.
 */
export function deviceClassOf(viewportWidth: number): DeviceClass {
  if (viewportWidth <= 768) return 'phone'
  if (viewportWidth <= 1024) return 'tablet'
  return 'desktop'
}

/** One device class's remembered layout. */
export interface LayoutsState {
  /** The layout this device class shows. */
  active: WorkspaceLayoutId
  /** The layout it showed before, so the last switch is one step back. */
  previous: WorkspaceLayoutId
}

/**
 * Create the layouts store handle. The framework does not own this store — a
 * layout is not per session or per pane — so `apply` instantiates it once with
 * the device class as its scope key.
 * @returns the store handle (spec + factory + persistence in one).
 */
export function createLayoutsStore() {
  return defineStore({
    persist: 'dsh.workspaceLayouts.v1',
    init: (): LayoutsState => ({ active: DEFAULT_LAYOUT, previous: DEFAULT_LAYOUT }),
    actions: {
      /**
       * Remember a switch.
       * @param draft - the state being written.
       * @param layout - the layout now active; a repeat of the active layout is not a switch.
       */
      setActive: (draft: LayoutsState, layout: WorkspaceLayoutId) => {
        if (draft.active === layout) return
        draft.previous = draft.active
        draft.active = layout
      },
    },
  })
}
