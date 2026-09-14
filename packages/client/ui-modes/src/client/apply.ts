/**
 * Applying a layout: two writes into facts that already exist — the layout
 * service's panel arrangement and the attribute the layout styles key on.
 * Nothing here mounts, unmounts, or reloads anything, which is what lets a
 * draft, a scroll position, and running work survive the switch.
 */
import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { WorkspaceLayoutId } from '@deepseek-ai/dsh-workspace-modes/client'
import { LAYOUT_ARRANGEMENTS } from './catalogue.ts'

/**
 * Attribute on the root element naming the active layout. One home for the
 * shell-level layout fact: the stylesheet beside this module reads it, and a
 * person debugging a layout reads the same value the app applied.
 */
export const LAYOUT_ATTRIBUTE = 'data-workspace-layout'

/**
 * Arrange the shell for one layout.
 * @param layout - the layout to arrange for.
 * @param service - the layout service face (`ctx.layout`).
 * @param root - the element carrying the layout attribute, or null outside a document.
 */
export function applyLayout(layout: WorkspaceLayoutId, service: ILayout, root: Element | null): void {
  service.setPanels(LAYOUT_ARRANGEMENTS[layout])
  root?.setAttribute(LAYOUT_ATTRIBUTE, layout)
}
