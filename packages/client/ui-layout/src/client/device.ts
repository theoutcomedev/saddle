/**
 * The device model: one classification for the whole shell.
 *
 * Before this module the shell answered "what device is this?" in five places
 * (1024 here, 768 in three packages, 720 in a primitive) and in fourteen CSS
 * breakpoints, so no part of the app could decide what a device should lose or
 * gain — only how wide a column should be. Everything device-shaped now reads
 * this, and the shell publishes the answer as attributes so CSS stops
 * re-deriving it.
 *
 * Class comes from the SHORTEST side of the viewport, which is what makes the
 * ladder orientation-proof: a phone in landscape (844×390) and in portrait
 * (390×844) are the same device, and an iPad (834×1112) is not a phone. Width
 * alone would classify both a 1440×900 laptop and a 1194×834 tablet as the same
 * thing.
 *
 * Input is a separate axis on purpose: an iPad Pro in landscape is 1366px wide
 * — laptop-sized — and still has no pointer. A layout that assumes a mouse
 * there is wrong, which is exactly the mistake a single width ladder makes.
 */

import { CENTER_MIN, DETAILS_DEFAULT, SIDEBAR_COLLAPSED } from './columns.ts'

/** The size bands of the ladder. */
export type DeviceClass = 'phone' | 'tablet' | 'laptop' | 'desktop'

/** The primary input the device offers. */
export type InputProfile = 'touch' | 'pointer'

/** Everything the shell knows about the device in front of it. */
export interface DeviceFacts {
  /** Size band, from the shortest viewport side. */
  class: DeviceClass
  /** Which way the viewport is longer. */
  orientation: 'portrait' | 'landscape'
  /** Primary input. */
  input: InputProfile
  /**
   * True when a pane cannot be docked beside the work on this device: it has to
   * be a sheet over it. Phone always; a tablet in portrait, where a docked pane
   * would leave less than the centre's floor.
   */
  sheetPanes: boolean
  /** Viewport width in px. */
  width: number
  /** Viewport height in px. */
  height: number
}

/**
 * The narrowest viewport that can hold a docked pane beside a workable centre:
 * the collapsed rail, the pane at its contract default, and the centre's floor,
 * all read from the geometry contract (columns.ts) rather than invented here.
 * Below it a pane cannot be *docked* — which is a fact about this viewport, not
 * about the device class, and the reason the two are separate answers.
 */
export const DOCK_MIN_WIDTH = SIDEBAR_COLLAPSED + DETAILS_DEFAULT + CENTER_MIN

/** Shortest-side upper bounds, inclusive. One ladder, one place. */
const PHONE_MAX = 500
const TABLET_MAX = 840
/** Width band: above this the device is a large display. */
const LAPTOP_MAX_WIDTH = 1600

/**
 * Classify a viewport and its input.
 * @param width - viewport width in px.
 * @param height - viewport height in px.
 * @param coarse - true when the primary pointer is coarse (touch).
 * @returns the device facts the shell renders against.
 */
export function classifyDevice(width: number, height: number, coarse: boolean): DeviceFacts {
  const shortest = Math.min(width, height)
  // A tablet band exists only for touch: a 1280x800 laptop has a tablet's
  // shortest side and a keyboard, which is the difference that matters. Phones
  // are banded by size alone — a small window on a laptop is still a small
  // window, and treating it as a phone-shaped surface is the safer mistake.
  const deviceClass: DeviceClass = shortest <= PHONE_MAX
    ? 'phone'
    : coarse && shortest <= TABLET_MAX ? 'tablet' : width <= LAPTOP_MAX_WIDTH ? 'laptop' : 'desktop'
  const orientation = width >= height ? 'landscape' : 'portrait'
  return {
    class: deviceClass,
    orientation,
    input: coarse ? 'touch' : 'pointer',
    // A phone never docks a pane; neither does any viewport too narrow to hold
    // one beside a workable centre. This is why a small desktop window and a
    // tablet in portrait give the same answer — because for the shell they are
    // the same situation.
    sheetPanes: deviceClass === 'phone' || width < DOCK_MIN_WIDTH,
    width,
    height,
  }
}

/** The attribute names the shell publishes device facts under. */
export const DEVICE_ATTRIBUTE = 'data-device'
/** Input profile attribute (a layout may not use hover-only controls on touch). */
export const INPUT_ATTRIBUTE = 'data-input'
/** Whether panes dock beside the work ('dock') or cover it ('sheet'). */
export const PANES_ATTRIBUTE = 'data-panes'

/**
 * Write the device facts onto the root element, where stylesheets, click
 * handlers that need one immediate answer, and a person debugging a layout can
 * all read them. Publishing the panes answer as well means a handler never has
 * to re-derive the device rule from a width.
 * @param root - the element to mark, or null outside a document.
 * @param facts - the facts to publish.
 */
export function publishDevice(root: Element | null, facts: DeviceFacts): void {
  root?.setAttribute(DEVICE_ATTRIBUTE, facts.class)
  root?.setAttribute(INPUT_ATTRIBUTE, facts.input)
  root?.setAttribute(PANES_ATTRIBUTE, facts.sheetPanes ? 'sheet' : 'dock')
}

/**
 * Read the panes rule back from the document. For handlers that fire outside
 * React's render (a click that must decide in the same tick) and that must not
 * re-derive the device ladder themselves.
 * @param root - the document root to read, defaulting to the live document.
 * @returns true when panes must be sheets on this device.
 */
export function panesAreSheets(root: Element | null = typeof document === 'undefined' ? null : document.documentElement): boolean {
  return root?.getAttribute(PANES_ATTRIBUTE) === 'sheet'
}
