/**
 * Applying a layout: one call into the shell's layout service, plus the
 * attribute that names the active layout.
 *
 * The service stores the specification and the frame resolves it against the
 * device (shell.ts), so this module never touches a width, a breakpoint, or the
 * layout — and a layout this device cannot render literally is still honoured by
 * the shell rather than dropped. The attribute is here because the *layout id* is
 * this package's vocabulary, while placement is the shell's.
 */
import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { WorkspaceLayoutId } from '@deepseek-ai/dsh-workspace-modes/client'
import { LAYOUTS } from './catalogue.ts'

/**
 * Attribute on the root element naming the active layout, for styles and for a
 * person reading the DOM to see what the app applied.
 */
export const LAYOUT_ATTRIBUTE = 'data-workspace-layout'

/**
 * Apply one layout to the shell.
 * @param layout - the layout to apply.
 * @param service - the layout service face (`ctx.layout`).
 * @param root - the element carrying the layout attribute, or null outside a document.
 */
export function applyLayout(layout: WorkspaceLayoutId, service: ILayout, root: Element | null): void {
  service.applyShell(LAYOUTS[layout].spec)
  root?.setAttribute(LAYOUT_ATTRIBUTE, layout)
}
