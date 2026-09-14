/**
 * Applying a mode: two writes into facts that already exist — the layout
 * service's panel arrangement and the attribute the mode styles key on.
 * Nothing here mounts, unmounts, or reloads anything, which is what lets a
 * draft, a scroll position, and running work survive the switch.
 */
import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { WorkspaceModeId } from '@deepseek-ai/dsh-workspace-modes/client'
import { MODE_ARRANGEMENTS } from './catalogue.ts'

/**
 * Attribute on the root element naming the active mode. One home for the
 * shell-level mode fact: the stylesheet beside this module reads it, and a
 * person debugging a layout reads the same value the app applied.
 */
export const MODE_ATTRIBUTE = 'data-workspace-mode'

/**
 * Arrange the shell for one mode.
 * @param mode - the mode to arrange for.
 * @param layout - the layout service face (`ctx.layout`).
 * @param root - the element carrying the mode attribute, or null outside a document.
 */
export function applyMode(mode: WorkspaceModeId, layout: ILayout, root: Element | null): void {
  layout.setPanels(MODE_ARRANGEMENTS[mode])
  root?.setAttribute(MODE_ATTRIBUTE, mode)
}
