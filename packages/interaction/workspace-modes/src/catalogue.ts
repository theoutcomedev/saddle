/**
 * The model-facing catalogue: the ids the tool accepts and the one line each of
 * them means. What a layout *looks* like belongs to the browser half — this
 * module owns only what the model may ask for, so the tool description and the
 * accepted enum cannot drift apart.
 */
import type { WorkspaceLayoutId } from './types.ts'

/** Every layout this build accepts, in the order the tool description lists them. */
export const WORKSPACE_LAYOUTS = ['default', 'focus', 'zen'] as const satisfies readonly WorkspaceLayoutId[]

/** One model-facing sentence per layout, carried into the tool description. */
export const WORKSPACE_LAYOUT_PURPOSES: Record<WorkspaceLayoutId, string> = {
  default: 'the shell\'s own shape: the session list open and the details column closed',
  focus: 'the session list out, with the details column opened wide beside the conversation',
  zen: 'both side panels out, with the conversation held to a narrow reading measure',
}
