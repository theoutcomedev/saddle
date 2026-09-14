/**
 * The resolver is where the shell stops lying. A layout asks for a pane beside
 * the work; a device that cannot hold both must still show the pane. Before this
 * module the request was silently dropped — a person tapped a file on a tablet
 * and watched nothing happen — and that is the defect these cases pin.
 */
import { describe, expect, it } from 'vitest'
import { classifyDevice, DOCK_MIN_WIDTH } from '../src/client/device.ts'
import { DEFAULT_SHELL, resolveShell, type ShellSpec } from '../src/client/shell.ts'
import {
  CENTER_MIN, DETAILS_DEFAULT, DETAILS_MAX, DETAILS_MIN, DETAILS_WIDE, SIDEBAR_COLLAPSED, computeColumns,
} from '../src/client/columns.ts'

const focus: ShellSpec = { ...DEFAULT_SHELL, details: 'column', detailsShown: true, detailsWidth: 'wide' }
/** The pane beside the work at its contract width — the shape whose centre floor the chain does not relax. */
const workbench: ShellSpec = { ...DEFAULT_SHELL, details: 'column', detailsShown: true }

/** One device and the open state a case resolves against. */
interface Case {
  width: number
  height: number
  coarse?: boolean
  sidebarOpen?: boolean
  detailsOpen?: boolean
  sidebarPreference?: number
  detailsPreference?: number
}

/**
 * Resolve a specification for one case.
 * @param spec - the shell specification under test.
 * @param k - the viewport, input, and open state.
 * @returns the resolution.
 */
function resolve(spec: ShellSpec, k: Case) {
  const facts = classifyDevice(k.width, k.height, k.coarse ?? false)
  return resolveShell(spec, facts, facts.width, {
    sidebarOpen: k.sidebarOpen ?? true,
    detailsOpen: k.detailsOpen ?? true,
    sidebarPreference: k.sidebarPreference ?? 280,
    detailsPreference: k.detailsPreference ?? DETAILS_WIDE,
  })
}

describe('resolveShell', () => {
  it('docks both surfaces on a wide device', () => {
    const resolved = resolve(focus, { width: 1440, height: 900 })
    expect(resolved.sidebar.placement).toBe('column')
    expect(resolved.details.placement).toBe('column')
    expect(resolved.details.substituted).toBe(false)
    expect(resolved.columns.details).toBe(DETAILS_WIDE)
  })

  it('opens the pane as a sheet where it cannot dock, instead of dropping it', () => {
    // A phone and a tablet in portrait: the request is honoured, by placement.
    for (const k of [{ width: 390, height: 844, coarse: true }, { width: 834, height: 1112, coarse: true }]) {
      const resolved = resolve(focus, { ...k, sidebarOpen: false, sidebarPreference: 0 })
      expect(resolved.details.placement).toBe('sheet')
      expect(resolved.details.substituted).toBe(true)
    }
  })

  it('docks beside the work on a tablet in landscape', () => {
    const resolved = resolve(focus, { width: 1194, height: 834, coarse: true })
    expect(resolved.details.placement).toBe('column')
    expect(resolved.details.substituted).toBe(false)
    expect(resolved.columns.details).toBe(DETAILS_WIDE)
  })

  it('puts the session list on its rail before covering the work with a sheet', () => {
    // 280 + 360 + the 640 centre floor is wider than a landscape tablet, so the
    // solve would have dropped the pane; the list gives way instead, and the pane
    // still lands beside the work.
    const resolved = resolve(workbench, { width: 1194, height: 834, coarse: true, detailsPreference: DETAILS_DEFAULT })
    expect(resolved.details.placement).toBe('column')
    expect(resolved.details.substituted).toBe(false)
    expect(resolved.sidebar.placement).toBe('column')
    expect(resolved.columns.sidebar).toBe(SIDEBAR_COLLAPSED)
    expect(resolved.columns.details).toBe(DETAILS_DEFAULT)
  })

  it('keeps the list where the pane is closed or the layout asks for a sheet', () => {
    const k = { width: 1194, height: 834, coarse: true, detailsPreference: DETAILS_DEFAULT }
    const closed = resolve(workbench, { ...k, detailsOpen: false, detailsPreference: 0 })
    expect(closed.columns.sidebar).toBe(280)
    const asSheet = resolve({ ...workbench, details: 'sheet' }, k)
    expect(asSheet.columns.sidebar).toBe(280)
    expect(asSheet.details.placement).toBe('sheet')
  })

  it('cannot fail the rail retry: the docking floor is the rail footprint', () => {
    // The retry above assumes a device wide enough to dock can dock with the list
    // railed. Pin that over the whole width range and every admissible pane width.
    for (let viewport = DOCK_MIN_WIDTH; viewport <= 2600; viewport += 7) {
      for (const pane of [DETAILS_MIN, DETAILS_DEFAULT, DETAILS_WIDE, 1180, DETAILS_MAX]) {
        expect(computeColumns(viewport, 0, pane).details, `pane ${pane} at ${viewport}`).toBeGreaterThan(0)
      }
      expect(computeColumns(viewport, 0, 0).sidebar).toBe(SIDEBAR_COLLAPSED)
    }
    expect(DOCK_MIN_WIDTH).toBe(SIDEBAR_COLLAPSED + DETAILS_DEFAULT + CENTER_MIN)
  })

  it('removes surfaces a layout asks to remove', () => {
    const zen: ShellSpec = { ...DEFAULT_SHELL, sidebar: 'none', details: 'none' }
    const resolved = resolve(zen, { width: 1440, height: 900 })
    expect(resolved.sidebar.placement).toBe('none')
    expect(resolved.details.placement).toBe('none')
    expect(resolved.columns.sidebar).toBe(0)
    expect(resolved.columns.details).toBe(0)
  })

  it('carries the layout chrome, composer shape, density and measure through', () => {
    const zen: ShellSpec = { ...DEFAULT_SHELL, header: 'compact', composer: 'none', density: 'roomy', measure: 760 }
    const resolved = resolve(zen, { width: 1440, height: 900, detailsOpen: false, detailsPreference: 0 })
    expect(resolved.header).toBe('compact')
    expect(resolved.composer).toBe('none')
    expect(resolved.density).toBe('roomy')
    expect(resolved.measure).toBe(760)
  })
})
