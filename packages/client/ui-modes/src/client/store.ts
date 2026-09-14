/**
 * Layout memory. A phone and a laptop are allowed to want different shapes, so
 * what each device class last showed is remembered per class — the class coming
 * from the shell's device model, never from a private ladder in this package.
 *
 * The class is followed, not captured at load: a window dragged into a phone's
 * band switches the memory with the same facts that change the shell's
 * placements, which is what keeps the picker listing the jobs this device
 * actually has. Nothing else about a layout is stored; the specification is
 * derived from the catalogue, so a change reaches every device on its next load.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import type { DeviceClass } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { WorkspaceLayoutId } from '@deepseek-ai/dsh-workspace-modes/client'
import { DEFAULT_LAYOUT } from './catalogue.ts'

/** The layout memory: what is in force, on which device class, and what each class held. */
export interface LayoutsState {
  /** The layout in force on the device class currently in front of the person. */
  active: WorkspaceLayoutId
  /** The device class `active` is in force on. */
  device: DeviceClass
  /** What each class last showed; a class with no entry has not chosen one yet. */
  remembered: Partial<Record<DeviceClass, WorkspaceLayoutId>>
}

/**
 * Annotation twin of the actions literal below (the export needs a declared
 * return type); drift fails assignability at the defineStore call.
 */
type LayoutsActions = {
  setActive: (draft: LayoutsState, layout: WorkspaceLayoutId) => void
  setDeviceClass: (draft: LayoutsState, device: DeviceClass) => void
}

/**
 * Create the layouts store handle. A layout is not per session or per pane, so
 * `apply` instantiates it once at root scope and the device class lives in the
 * state, where following the browser can move it.
 * @returns the store handle (spec + actions + persistence in one).
 */
export function createLayoutsStore(): EngineStoreHandle<LayoutsState, LayoutsActions> {
  return defineStore({
    persist: 'dsh.workspaceLayouts.v2',
    init: (): LayoutsState => ({ active: DEFAULT_LAYOUT, device: 'desktop', remembered: {} }),
    actions: {
      /**
       * Remember a switch on the device class it was made on.
       * @param draft - the state being written.
       * @param layout - the layout now active; a repeat of the active layout is not a switch.
       */
      setActive: (draft: LayoutsState, layout: WorkspaceLayoutId) => {
        if (draft.active === layout) return
        draft.active = layout
        draft.remembered[draft.device] = layout
      },
      /**
       * Follow the device class, taking up that class's own remembered layout.
       * @param draft - the state being written.
       * @param device - the class the browser now reports.
       */
      setDeviceClass: (draft: LayoutsState, device: DeviceClass) => {
        if (draft.device === device) return
        draft.remembered[draft.device] = draft.active
        draft.device = device
        draft.active = draft.remembered[device] ?? DEFAULT_LAYOUT
      },
    },
  })
}
