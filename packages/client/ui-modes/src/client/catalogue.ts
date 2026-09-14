/**
 * The workspace-layout catalogue. A layout is a recipe over layout facts the
 * shell already owns — which panels are out, how much room the pane gets, how
 * wide the reading measure is — so adding one is an entry here plus its copy,
 * never a new code path. Nothing in this module reads the DOM, the store, or
 * the context.
 *
 * The naming is deliberate: an agent preset is what the assistant may do, a
 * layout is the shape of the screen it does it on. Calling both a "mode" is
 * what made two chips in one header unreadable.
 */
import type { PanelArrangement } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { WorkspaceLayoutId } from '@deepseek-ai/dsh-workspace-modes/client'

/** The layout a device class shows before anyone chooses one. */
export const DEFAULT_LAYOUT: WorkspaceLayoutId = 'default'

/** Picker order: the plainest arrangement first, the most opinionated last. */
export const LAYOUT_ORDER: readonly WorkspaceLayoutId[] = ['default', 'focus', 'zen']

/**
 * Each layout's arrangement of the two panels the shell owns. The reading
 * measure rides the same entry point as the panels (see layouts-chrome.module.css),
 * keyed on the layout attribute rather than on a second data field.
 */
export const LAYOUT_ARRANGEMENTS: Record<WorkspaceLayoutId, PanelArrangement> = {
  // Default is the shell's own shape — the session list open and the details
  // column closed — so leaving a layout lands where a first load does.
  default: { sidebar: 'default', details: 'closed' },
  focus: { sidebar: 'closed', details: 'wide' },
  zen: { sidebar: 'closed', details: 'closed' },
}
