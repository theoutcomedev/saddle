/**
 * The workspace-mode catalogue. A mode is a recipe over layout facts the shell
 * already owns — which panels are out, how much room the pane gets, how wide
 * the reading measure is — so adding one is an entry here plus its copy, never
 * a new code path. Nothing in this module reads the DOM, the store, or the
 * context.
 */
import type { PanelArrangement } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { WorkspaceModeId } from '@deepseek-ai/dsh-workspace-modes/client'

/** The mode a device class shows before anyone chooses one. */
export const DEFAULT_MODE: WorkspaceModeId = 'standard'

/** Picker order: the plainest arrangement first, the most opinionated last. */
export const MODE_ORDER: readonly WorkspaceModeId[] = ['standard', 'focus', 'zen']

/**
 * Each mode's arrangement of the two panels the shell owns. The reading
 * measure rides the same entry point as the panels (see modes-chrome.module.css),
 * keyed on the mode attribute rather than on a second data field.
 */
export const MODE_ARRANGEMENTS: Record<WorkspaceModeId, PanelArrangement> = {
  // Standard is the shell's own default shape — the session list open and the
  // details column closed — so leaving a mode lands where a first load does.
  standard: { sidebar: 'default', details: 'closed' },
  focus: { sidebar: 'closed', details: 'wide' },
  zen: { sidebar: 'closed', details: 'closed' },
}
