/**
 * The workspace-layout catalogue. A layout is a *shell specification* — where
 * each surface sits, how much chrome is left, which composer is shown, how much
 * air and what reading measure — so adding one is an entry here plus its copy,
 * never a code path through the shell.
 *
 * Each entry also names the device classes it is offered on. That is what makes
 * a phone's picker list phone jobs instead of a universal list of adjectives,
 * and why a desktop never offers a controller surface.
 *
 * The vocabulary is "layout", never "mode": the same header carries the
 * session's agent preset, which is what the assistant may do. Two concepts
 * called "mode" in one row is the confusion this naming exists to prevent.
 */
import type { DeviceClass, ShellSpec } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { WorkspaceLayoutId } from '@deepseek-ai/dsh-workspace-modes/client'

/** The layout a device class shows before anyone chooses one. */
export const DEFAULT_LAYOUT: WorkspaceLayoutId = 'default'

/** One layout: what the shell becomes, and which devices it is for. */
export interface LayoutDefinition {
  /** Shell specification the layout applies. */
  spec: ShellSpec
  /** Device classes whose picker offers this layout. */
  devices: readonly DeviceClass[]
}

/** Every device class, for the layouts that are not device-specific. */
const EVERY: readonly DeviceClass[] = ['phone', 'tablet', 'laptop', 'desktop']

/**
 * The catalogue. Phone entries are jobs — capture, read — because a phone has no
 * room for a shape to be merely wider; tablet entries are postures; desktop
 * entries are desk shapes.
 */
export const LAYOUTS: Record<WorkspaceLayoutId, LayoutDefinition> = {
  default: {
    devices: EVERY,
    // The pane is available and closed: the workbench and file links open it on
    // demand, which is what "column" means here — available, not shown.
    spec: { sidebar: 'column', details: 'column', sidebarShown: true, detailsShown: false, detailsWidth: 'default', header: 'full', composer: 'full', density: 'comfortable', measure: null },
  },
  // Phone: the composer is the primary surface and the session list is an
  // overlay the person pulls in.
  capture: {
    devices: ['phone'],
    spec: { sidebar: 'sheet', details: 'none', sidebarShown: false, detailsShown: false, detailsWidth: 'default', header: 'compact', composer: 'full', density: 'roomy', measure: null },
  },
  // Phone: reading. The composer is gone until asked for, which is the whole
  // difference from Capture.
  read: {
    devices: ['phone'],
    spec: { sidebar: 'sheet', details: 'none', sidebarShown: false, detailsShown: false, detailsWidth: 'default', header: 'compact', composer: 'none', density: 'roomy', measure: null },
  },
  // One document and the pane beside it. On a device that cannot dock the pane,
  // the shell opens it as a sheet rather than dropping it.
  focus: {
    devices: EVERY,
    spec: { sidebar: 'column', details: 'column', sidebarShown: true, detailsShown: true, detailsWidth: 'wide', header: 'full', composer: 'full', density: 'comfortable', measure: null },
  },
  // Writing: no side surfaces, a reading measure, one step up in type.
  zen: {
    devices: ['tablet', 'laptop', 'desktop'],
    spec: { sidebar: 'none', details: 'none', sidebarShown: false, detailsShown: false, detailsWidth: 'default', header: 'compact', composer: 'minimal', density: 'roomy', measure: 760 },
  },
  // The pane is part of the desk rather than something the person opens.
  workbench: {
    devices: ['tablet', 'laptop', 'desktop'],
    spec: { sidebar: 'column', details: 'column', sidebarShown: true, detailsShown: true, detailsWidth: 'default', header: 'full', composer: 'full', density: 'comfortable', measure: null },
  },
  // Shared posture: the artifact leads, the operator's chrome is away, and the
  // exit is deliberate.
  counter: {
    devices: ['tablet'],
    spec: { sidebar: 'none', details: 'none', sidebarShown: false, detailsShown: false, detailsWidth: 'default', header: 'compact', composer: 'none', density: 'roomy', measure: null },
  },
  // Making: dense chrome, the pane open wide, the conversation out of the way.
  studio: {
    devices: ['laptop', 'desktop'],
    spec: { sidebar: 'column', details: 'column', sidebarShown: true, detailsShown: true, detailsWidth: 'wide', header: 'compact', composer: 'minimal', density: 'compact', measure: null },
  },
  // A display nobody is sitting at.
  wall: {
    devices: ['desktop'],
    spec: { sidebar: 'none', details: 'none', sidebarShown: false, detailsShown: false, detailsWidth: 'default', header: 'compact', composer: 'none', density: 'compact', measure: null },
  },
}

/** Every layout id, in the catalogue's own order (the drift spec reads this pair). */
export const LAYOUT_ORDER: readonly WorkspaceLayoutId[] = Object.keys(LAYOUTS) as WorkspaceLayoutId[]

/**
 * The layouts one device class offers, in catalogue order.
 * @param deviceClass - the device class to list for.
 * @returns the layout ids whose picker this device shows.
 */
export function layoutsFor(deviceClass: DeviceClass): readonly WorkspaceLayoutId[] {
  return LAYOUT_ORDER.filter(id => LAYOUTS[id].devices.includes(deviceClass))
}
