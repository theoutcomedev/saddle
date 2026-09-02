/**
 * Workbench pane slot contract. The pane slots themselves are declared in
 * ui-layout (which owns the `details` column slot) so both the Workbench
 * occupant (this package) and a re-homed pane (ui-conversation's Details panel)
 * can name the keys without a cross-package dependency cycle. This module loads
 * that augmentation and re-exports the shared owner share.
 */
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'

/** The workbench pane owner share, borrowed from ui-layout. */
export type { WorkbenchPaneOwnerProps } from '@deepseek-ai/dsh-client-ui-layout/client'
