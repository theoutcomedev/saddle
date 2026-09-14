/**
 * The root entry's transient layout store: the panel geometry, the shell
 * specification the active layout asked for, and the device facts everything
 * else is resolved against.
 *
 * Panel geometry is plain widths in px (0 = closed) and stays the person's
 * (drag) state. The shell specification is the *layout's* state: placements,
 * chrome, composer shape, density and measure. Device facts are neither: they
 * are what the browser says, written here so a pure component can read them
 * through its one store share without a context.
 *
 * The sheet form of the sidebar has its own open flag (`sidebarSheetOpen`):
 * a phone's session list is an overlay, not a column, so "open" cannot be a
 * width. Module level exports the factory only — a module-level handle would
 * pin the store's identity in the module cache (a de-facto singleton surviving
 * plugin reloads).
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import {
  clampWidth, DETAILS_DEFAULT, DETAILS_MAX, DETAILS_MIN, DETAILS_WIDE,
  SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN,
} from './columns.ts'
import { classifyDevice, type DeviceFacts } from './device.ts'
import { DEFAULT_SHELL, type ShellSpec } from './shell.ts'

/**
 * Layout state: the two panel widths (0 = closed), the sidebar's sheet flag,
 * the active shell specification, and the device facts in front of the person.
 * `sheetPanes` lives on the device facts, not here — the shell asks the device
 * what it can dock instead of remembering a breakpoint it crossed.
 */
export interface LayoutState {
  /** Wide sidebar preference in px (0 = closed). */
  sidebar: number
  /** Details width in px (0 = closed). */
  details: number
  /** Open state of the sidebar's sheet form (the narrow overlay). */
  sidebarSheetOpen: boolean
  /**
   * True once the person has asked for a surface the active layout removed.
   * The spec decides what is available; a gesture overrides a removal, so a
   * layout can be minimal without making a click do nothing.
   */
  surfaceRequested: boolean
  /** What the active layout asked the shell to be. */
  shell: ShellSpec
  /** What the browser says about this device. */
  device: DeviceFacts
}

/**
 * The device facts at store creation, so the first render is already right.
 * @returns the classified facts for the current window.
 */
function initialDevice(): DeviceFacts {
  if (typeof window === 'undefined') return classifyDevice(1440, 900, false)
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches === true
  return classifyDevice(window.innerWidth, window.innerHeight, coarse)
}

/**
 * Annotation twin of the actions literal below (the export needs a declared
 * return type); drift fails assignability at the defineStore call.
 */
type LayoutActions = {
  setSidebar: (draft: LayoutState, px: number) => void
  setDetails: (draft: LayoutState, px: number) => void
  toggleSidebar: (draft: LayoutState, sheetPanes: boolean) => void
  closeSidebar: (draft: LayoutState) => void
  openSidebarSheet: (draft: LayoutState) => void
  closeSidebarSheet: (draft: LayoutState) => void
  setDevice: (draft: LayoutState, facts: DeviceFacts) => void
  setShell: (draft: LayoutState, spec: ShellSpec) => void
  openDetails: (draft: LayoutState) => void
  closeDetails: (draft: LayoutState) => void
  toggleDetails: (draft: LayoutState) => void
}

/**
 * Create the layout panel store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createLayoutStore(): EngineStoreHandle<LayoutState, LayoutActions> {
  const handle = defineStore({
    init: (): LayoutState => ({
      sidebar: SIDEBAR_DEFAULT,
      details: 0,
      sidebarSheetOpen: false,
      surfaceRequested: false,
      shell: DEFAULT_SHELL,
      device: initialDevice(),
    }),
    actions: {
      setSidebar: (d, px: number) => { d.sidebar = clampWidth(px, SIDEBAR_MIN, SIDEBAR_MAX) },
      setDetails: (d, px: number) => { d.details = clampWidth(px, DETAILS_MIN, DETAILS_MAX) },
      // Docking devices close and open a column; sheet devices open and close an
      // overlay. The caller supplies which, because the device knows and a store
      // remembering a crossed breakpoint was how the two answers drifted apart.
      toggleSidebar: (d, sheetPanes: boolean) => {
        if (sheetPanes) d.sidebarSheetOpen = !d.sidebarSheetOpen
        else d.sidebar = d.sidebar === 0 ? SIDEBAR_DEFAULT : 0
        d.surfaceRequested = true
      },
      // "The sidebar is not showing" is one state with two forms, so one action
      // covers both: a layout asking for none, and a person dismissing the
      // drawer that was over the work.
      closeSidebar: (d) => { d.sidebar = 0; d.sidebarSheetOpen = false; d.surfaceRequested = false },
      openSidebarSheet: (d) => { d.sidebarSheetOpen = true; d.surfaceRequested = true },
      closeSidebarSheet: (d) => { d.sidebarSheetOpen = false },
      setDevice: (d, facts: DeviceFacts) => {
        if (d.device.class === facts.class && d.device.orientation === facts.orientation
          && d.device.input === facts.input && d.device.sheetPanes === facts.sheetPanes
          && d.device.width === facts.width && d.device.height === facts.height) return
        d.device = facts
      },
      // Applying a layout writes the specification AND the openness it implies:
      // a layout that names a surface means it to be seen, and one that says
      // "none" means the surface is out of the way until the person asks.
      setShell: (d, spec: ShellSpec) => {
        d.shell = spec
        d.surfaceRequested = false
        // A layout names what is on screen and where it sits; the person's own
        // toggles stay theirs afterwards.
        const sidebarVisible = spec.sidebar !== 'none' && spec.sidebarShown
        d.sidebarSheetOpen = sidebarVisible && spec.sidebar === 'sheet'
        d.sidebar = sidebarVisible && spec.sidebar === 'column' ? SIDEBAR_DEFAULT : 0
        d.details = spec.details !== 'none' && spec.detailsShown
          ? (spec.detailsWidth === 'wide' ? DETAILS_WIDE : DETAILS_DEFAULT)
          : 0
      },
      openDetails: (d) => { d.details = d.details === 0 ? DETAILS_DEFAULT : d.details; d.surfaceRequested = true },
      closeDetails: (d) => { d.details = 0; d.surfaceRequested = false },
      toggleDetails: (d) => {
        d.details = d.details === 0 ? DETAILS_DEFAULT : 0
        d.surfaceRequested = true
      },
    },
  })
  return handle
}
