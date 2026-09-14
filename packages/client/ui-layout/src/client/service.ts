/**
 * The cross-plugin faces behind `ctx.layout` and `ctx.device`.
 *
 * `ctx.layout` is the panel-action face other plugins reach for: the sidebar
 * toggle, the details open/close pair, and `applyShell` — the one call a
 * workspace layout makes. Writes stay inside the store's declared action set,
 * delivered as the registration's bound actions.
 *
 * `ctx.device` is what the browser says about the machine in front of the
 * person. It is a separate service from the layout because the two questions
 * are different: what should the shell be (a layout's job) and what can this
 * device do (the browser's). Nothing may answer the second one from a
 * breakpoint again — that is how the shell ended up with five of them.
 */
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { createLayoutStore } from './stores.ts'
import {
  classifyDevice, panesAreSheets, publishDevice, type DeviceFacts,
} from './device.ts'
import type { ShellSpec } from './shell.ts'

/** The layout store's bound action set (framework-baked, draft params peeled). */
export type PanelActions = BoundActions<ReturnType<typeof createLayoutStore>>

/**
 * The outward layout face (`ctx.layout`): the panel transitions other plugins
 * may trigger, and the one call a layout makes — exactly what a test fake must
 * supply. The attachPanels wiring hook stays on the concrete class (root-entry
 * assembly only).
 */
export interface ILayout {
  /** Toggle the sidebar surface (column on a docking device, sheet otherwise). */
  toggleSidebar(): void
  /** Open the details pane (no-op when already open). */
  openDetails(): void
  /** Close the details pane. */
  closeDetails(): void
  /** Toggle the details pane. */
  toggleDetails(): void
  /**
   * Apply a workspace layout's shell specification.
   * @param spec - placements, chrome, composer shape, density and measure.
   */
  applyShell(spec: ShellSpec): void
}

/** Cross-plugin layout face (ctx.layout). */
export class LayoutController implements ILayout {
  #panels: PanelActions | undefined

  /**
   * Adopt the root entry's bound store actions. Called from the root
   * registration's inject hook (a sanctioned assembly side effect), so the
   * face is live from the entry's first render; on entry re-register the
   * fresh actions overwrite the stale set.
   * @param actions - bound actions of the entry's layout store instance.
   */
  attachPanels(actions: PanelActions): void {
    this.#panels = actions
  }

  /** Toggle the sidebar surface (column on a docking device, sheet otherwise). */
  toggleSidebar(): void {
    this.#require().toggleSidebar(panesAreSheets())
  }

  /** Open the details pane (no-op when already open). */
  openDetails(): void {
    this.#require().openDetails()
  }

  /** Close the details pane. */
  closeDetails(): void {
    this.#require().closeDetails()
  }

  /** Toggle the details pane. */
  toggleDetails(): void {
    this.#require().toggleDetails()
  }

  /** Apply a workspace layout's shell specification. */
  applyShell(spec: ShellSpec): void {
    this.#require().setShell(spec)
  }

  #require(): PanelActions {
    // Callers are UI gestures, which cannot fire before the root entry
    // rendered (the inject hook runs in its first render) — reaching this
    // unwired is a boot-order bug, not a race to tolerate.
    if (this.#panels === undefined) throw new Error('layout: panel actions not wired (root entry not mounted)')
    return this.#panels
  }
}

/** The outward device face (`ctx.device`). */
export interface IDevice {
  /**
   * The device facts as of the last measurement.
   * @returns the classified facts.
   */
  facts(): DeviceFacts
  /**
   * Follow the device class across changes. The listener runs after the facts
   * and the published attributes agree, so a consumer that reads the facts it is
   * handed sees the same answer as the root element.
   * @param listener - called with the new facts on every change.
   * @returns the disposer that stops following.
   */
  watch(listener: (facts: DeviceFacts) => void): () => void
}

/**
 * Watches the browser and publishes what it says: viewport size, orientation,
 * and whether the primary pointer is coarse. The facts land on the root element
 * as attributes (so stylesheets and immediate click handlers read one answer)
 * and in the layout store (so the frame's pure component can render against
 * them through its own store share).
 */
export class DeviceController implements IDevice {
  #facts: DeviceFacts
  #setFacts: ((facts: DeviceFacts) => void) | undefined
  #media: MediaQueryList | undefined
  readonly #listeners = new Set<(facts: DeviceFacts) => void>()

  /** @param root - the element device attributes are published on. */
  constructor(private readonly root: Element | null = typeof document === 'undefined' ? null : document.documentElement) {
    this.#facts = this.#classify()
    publishDevice(this.root, this.#facts)
  }

  /**
   * Adopt the store write, so the frame reads the same facts the attributes
   * carry. The store is the framework's; this is the sanctioned wiring hook.
   * @param setFacts - the store's bound device action.
   */
  attachStore(setFacts: (facts: DeviceFacts) => void): void {
    this.#setFacts = setFacts
    setFacts(this.#facts)
  }

  /** The device facts as of the last measurement. */
  facts(): DeviceFacts {
    return this.#facts
  }

  /** Follow the device class across changes. */
  watch(listener: (facts: DeviceFacts) => void): () => void {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }

  /**
   * Start watching the browser.
   * @returns the disposer that stops watching.
   */
  start(): () => void {
    if (typeof window === 'undefined') return () => {}
    const sync = (): void => { this.#sync() }
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    this.#media = window.matchMedia?.('(pointer: coarse)')
    this.#media?.addEventListener?.('change', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
      this.#media?.removeEventListener?.('change', sync)
    }
  }

  #classify(): DeviceFacts {
    if (typeof window === 'undefined') return classifyDevice(1440, 900, false)
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches === true
    return classifyDevice(window.innerWidth, window.innerHeight, coarse)
  }

  #sync(): void {
    const next = this.#classify()
    const same = next.class === this.#facts.class && next.orientation === this.#facts.orientation
      && next.input === this.#facts.input && next.width === this.#facts.width && next.height === this.#facts.height
    if (same) return
    this.#facts = next
    publishDevice(this.root, next)
    this.#setFacts?.(next)
    for (const listener of this.#listeners) listener(next)
  }
}
