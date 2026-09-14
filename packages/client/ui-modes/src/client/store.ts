/**
 * Per-device-class mode memory. A phone and a laptop are allowed to want
 * different shapes, so the remembered mode is keyed by device class: the
 * store's own scope key, which `defineStore` appends to its persist name.
 * Nothing else about a mode is stored — the arrangement is derived from the
 * catalogue, so a recipe change reaches every device on its next load.
 */
import { defineStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceModeId } from '@deepseek-ai/dsh-workspace-modes/client'
import { DEFAULT_MODE } from './catalogue.ts'

/** The device classes a mode is remembered for. */
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

/** One device class's remembered mode. */
export interface ModesState {
  /** The mode this device class shows. */
  active: WorkspaceModeId
  /** The mode it showed before, so the last switch is one step back. */
  previous: WorkspaceModeId
}

/**
 * Create the modes store handle. The framework does not own this store — a
 * mode is not per session or per pane — so `apply` instantiates it once with
 * the device class as its scope key.
 * @returns the store handle (spec + factory + persistence in one).
 */
export function createModesStore() {
  return defineStore({
    persist: 'dsh.workspaceModes.v1',
    init: (): ModesState => ({ active: DEFAULT_MODE, previous: DEFAULT_MODE }),
    actions: {
      /**
       * Remember a switch.
       * @param draft - the state being written.
       * @param mode - the mode now active; a repeat of the active mode is not a switch.
       */
      setActive: (draft: ModesState, mode: WorkspaceModeId) => {
        if (draft.active === mode) return
        draft.previous = draft.active
        draft.active = mode
      },
    },
  })
}
