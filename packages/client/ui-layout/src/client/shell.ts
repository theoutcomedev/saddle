/**
 * The shell specification and its resolution: a layout says what the screen
 * should be, the device decides how that can be true.
 *
 * The rule this module exists to enforce is that a request is never silently
 * dropped. Before it, a layout could ask for a pane beside the work on a device
 * that could not hold it and the shell would render nothing at all — the person
 * tapped a file and watched nothing happen. Now the resolver substitutes the
 * placement (a sheet over the work) and the pane still opens, which is what the
 * request meant.
 */
import { DOCK_MIN_WIDTH, type DeviceFacts } from './device.ts'
import { computeColumns } from './columns.ts'

/** How a surface may be placed. */
export type SurfacePlacement = 'column' | 'sheet' | 'none'

/** How much of the chrome a layout keeps. */
export type ChromeLevel = 'full' | 'compact'

/** Which composer a layout shows. */
export type ComposerShape = 'full' | 'minimal' | 'none'

/** How much air the layout leaves. */
export type Density = 'compact' | 'comfortable' | 'roomy'

/** What a layout asks the shell to be. */
export interface ShellSpec {
  /** Where the session list lives when it is on screen. */
  sidebar: SurfacePlacement
  /** Where the pane beside the work lives when it is on screen. */
  details: SurfacePlacement
  /** Whether the session list is on screen as part of this layout. */
  sidebarShown: boolean
  /** Whether the pane is on screen as part of this layout. */
  detailsShown: boolean
  /** How wide the pane is when it is a column. */
  detailsWidth: 'default' | 'wide'
  /** Header chrome level. */
  header: ChromeLevel
  /** Composer shape. */
  composer: ComposerShape
  /** Density scale. */
  density: Density
  /** Reading measure for the centre column in px, or null for the full width. */
  measure: number | null
}

/** The shell as it renders today: default shape, full chrome, comfortable. */
export const DEFAULT_SHELL: ShellSpec = {
  sidebar: 'column',
  details: 'column',
  sidebarShown: true,
  detailsShown: false,
  detailsWidth: 'default',
  header: 'full',
  composer: 'full',
  density: 'comfortable',
  measure: null,
}

/** Where a surface actually lands after the device has its say. */
export interface ResolvedSurface {
  /** The placement that will be rendered. */
  placement: SurfacePlacement
  /** True when the layout asked for a docked surface and the device gave a sheet. */
  substituted: boolean
}

/** The shell spec as resolved against one device and viewport. */
export interface ShellResolution {
  sidebar: ResolvedSurface
  details: ResolvedSurface
  /** Column widths for this viewport (0 = not a column). */
  columns: { sidebar: number; center: number; details: number }
  header: ChromeLevel
  composer: ComposerShape
  density: Density
  measure: number | null
}

/**
 * Resolve one surface's placement.
 * @param placement - what the layout asked for.
 * @param open - whether the surface is currently open at all.
 * @param dockable - whether this device can dock the surface beside the work.
 * @returns the placement to render, and whether it was substituted.
 */
function resolveSurface(placement: SurfacePlacement, open: boolean, dockable: boolean): ResolvedSurface {
  // "none" means the layout takes the surface away; a column that is merely
  // closed still renders at zero width, because the subtree stays mounted there
  // (state survives a closed pane). A sheet has nothing to render while closed.
  if (placement === 'none') return { placement: 'none', substituted: false }
  if (placement === 'sheet' || !dockable) {
    return open
      ? { placement: 'sheet', substituted: placement === 'column' }
      : { placement: 'none', substituted: false }
  }
  return { placement: 'column', substituted: false }
}

/**
 * Resolve a shell spec for one device and viewport.
 * @param spec - what the layout asked for.
 * @param facts - the device in front of the person.
 * @param viewport - the frame's width in px.
 * @param openState - which of the two surfaces the person has open (mode-independent state).
 * @returns the shell as it will actually render.
 */
export function resolveShell(
  spec: ShellSpec,
  facts: DeviceFacts,
  viewport: number,
  openState: {
    sidebarOpen: boolean
    detailsOpen: boolean
    /** The person's sidebar width preference (0 = closed; the solver renders the rail). */
    sidebarPreference: number
    /** The person's details width preference (0 = closed). */
    detailsPreference: number
    requested?: boolean
  },
): ShellResolution {
  // A layout may take a surface away; a person's gesture still gets it. The
  // spec decides what is *available*, and an explicit request overrides a
  // removal — otherwise clicking a file in a writing layout would do nothing,
  // which is the defect this module exists to prevent.
  const requested = openState.requested === true
  const sidebarSpec = spec.sidebar === 'none' && requested ? 'column' : spec.sidebar
  const detailsSpec = spec.details === 'none' && requested ? 'column' : spec.details
  // The sidebar never becomes a sheet by width: it is the navigation surface, so
  // a device that cannot dock it opens it over the work (which is what the
  // narrow drawer already was).
  const sidebar = resolveSurface(sidebarSpec, openState.sidebarOpen, !facts.sheetPanes)
  let sidebarPreference = sidebar.placement === 'column' ? openState.sidebarPreference : 0
  const requestedDetails = detailsSpec === 'none' || !openState.detailsOpen ? 0 : openState.detailsPreference
  let columns = computeColumns(viewport, sidebarPreference, requestedDetails)
  // A column that the solver would drop is a sheet instead: the person asked for
  // the pane, and a request the shell cannot honour as a column is still a
  // request to see it.
  let dockable = !facts.sheetPanes && (requestedDetails === 0 || columns.details > 0)
  // Before the pane becomes a sheet over the work, the session list gives way to
  // its rail: a layout that asks for the pane beside the work means the pane, and
  // navigation is the surface that can afford to shrink. This retry cannot fail —
  // above DOCK_MIN_WIDTH the rail, the smallest admissible pane and the centre
  // floor still fit, because the docking floor is defined as exactly those three
  // (device.ts), and the shell spec pins it over the width range. The stored
  // preference is untouched: a wider window brings the list back, and a drag after
  // this is the person's own answer, which the solve then honours.
  if (detailsSpec === 'column' && !dockable && !facts.sheetPanes && sidebarPreference !== 0 && viewport >= DOCK_MIN_WIDTH) {
    sidebarPreference = 0
    columns = computeColumns(viewport, 0, requestedDetails)
    dockable = true
  }
  const details = resolveSurface(detailsSpec, openState.detailsOpen, dockable)

  return {
    sidebar,
    details,
    columns: sidebar.placement === 'column' ? columns : { ...columns, sidebar: 0 },
    header: spec.header,
    composer: spec.composer,
    density: spec.density,
    measure: spec.measure,
  }
}
