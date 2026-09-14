/**
 * Workspace layouts on the host side: the model-facing tool that changes the
 * shape of a session's screen, and the durable record of what it asked for.
 *
 * The tool writes one `workspace/layout` event and nothing else — the browser
 * half reads the fold of that event through the `workspaceLayout` projection
 * and arranges the shell, which keeps the request in the log, replayable, and
 * identical across a reload or a second tab. A non-agent caller has no session
 * to record into and is rejected.
 *
 * "Layout" is the whole vocabulary here on purpose: an agent preset is what the
 * assistant may do, a layout is the shape of the screen it does it on, and one
 * word for both would make the header's two chips unreadable.
 *
 * @module @deepseek-ai/dsh-workspace-modes
 */

import type { Context } from '@deepseek-ai/cordis'
import { z as zod } from 'zod'
import type { ZodType } from 'zod'
import { defineTool } from '@deepseek-ai/dsh-tools'
// Type-only: resolves ctx.sessionProjections for the optional unit child.
import type {} from '@deepseek-ai/dsh-session-projection'
import { WORKSPACE_LAYOUTS, WORKSPACE_LAYOUT_PURPOSES } from './catalogue.ts'
import type { WorkspaceLayoutId, WorkspaceLayoutState } from './types.ts'

// The `workspaceLayout` projection-key declaration lives in src/types.ts (its
// one home); this re-export projects the type face onto the package root AND
// keeps the module edge in the emitted index.d.ts, so aggregate programs
// consuming the declarations still receive the SessionProjectionMap merge.
export type * from './types.ts'

// The catalogue is public: the browser package's spec reads the accepted ids
// beside its own arrangements, which is what keeps the two halves together.
export { WORKSPACE_LAYOUTS, WORKSPACE_LAYOUT_PURPOSES } from './catalogue.ts'

export const name = 'workspace-modes'
export const inject = ['tools']

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * The shape this session asked its screen to take: log-only, non-surface,
     * whole-value replace. The last `workspace/layout` wins, and the span
     * between two of them is the sequence a renderer uses to tell two requests
     * for the same layout apart. The browser half consumes it through the
     * `workspaceLayout` projection; the model sees only the tool result.
     */
    'workspace/layout': { layout: WorkspaceLayoutId }
  }
}

/** Wire payload schema of the `workspaceLayout` projection (a recorded request, or pre-first-request null). */
const workspaceLayoutSchema: ZodType<WorkspaceLayoutState | null> = zod.union([
  zod.object({
    layout: zod.union([zod.literal('default'), zod.literal('focus'), zod.literal('zen')]),
    at: zod.number().int().nonnegative(),
  }),
  zod.null(),
])

/** The tool's model-facing description, derived from the catalogue. */
function describe(): string {
  const lines = WORKSPACE_LAYOUTS.map(layout => `- ${layout}: ${WORKSPACE_LAYOUT_PURPOSES[layout]}`).join('\n')
  return 'Rearrange the person\'s screen — which panels are out, how much room the pane beside the work '
    + 'gets, how wide the reading measure is. This is the shape of the screen, not what the assistant can '
    + `do (that is the session\'s preset, and the person chooses it separately).\nAvailable layouts:\n${lines}\n`
    + 'Use it when the request or the work clearly suits a shape — a long writing or reading pass, a review '
    + 'that wants the pane beside the document, or a return to the plain shell. The change applies at once '
    + 'for the session in view, it closes nothing and interrupts nothing, and the person can leave the '
    + 'layout with one click.'
}

/**
 * Register the `set_workspace_layout` tool and, when the session-projection
 * seam is composed, the `workspaceLayout` unit.
 * @param ctx - registrant context carrying the tool registry.
 */
export function apply(ctx: Context): void {
  // The unit child activates only when a projection registry is composed
  // (headless assemblies stay unaffected). Last-wins fold; every other event
  // returns the same state reference, which is the registry's change gate.
  ctx.inject(['sessionProjections'], (projectionCtx) => {
    projectionCtx.sessionProjections.register<'workspaceLayout', WorkspaceLayoutState | null>({
      key: 'workspaceLayout',
      stateSchema: workspaceLayoutSchema,
      init: () => null,
      apply: (state, event) => event.type === 'workspace/layout'
        ? { layout: event.data.layout, at: event.seq }
        : state,
      wire: { viewSchema: workspaceLayoutSchema, view: state => state },
      stateVersion: 1,
    })
  })

  ctx.tools.register(defineTool({
    name: 'set_workspace_layout',
    description: describe(),
    parameters: {
      layout: {
        type: 'string',
        required: true,
        enum: [...WORKSPACE_LAYOUTS],
        description: 'The arrangement to show. Pick the one the work wants, not a favourite.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          result: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.result }],
    },
    execute(args, exec) {
      const layout = args.layout
      // The schema enum and the catalogue are one list, but the model boundary
      // is still a boundary: an unknown id would otherwise be written into the
      // log and shown as an unknown layout by every client.
      if (!(WORKSPACE_LAYOUTS as readonly string[]).includes(layout)) {
        throw new Error(`unknown workspace layout "${layout}"; expected one of ${WORKSPACE_LAYOUTS.join(', ')}`)
      }
      if (!exec.agent) {
        // The request belongs to a session's log; a caller without an owning
        // session has nowhere to record it. Reject rather than silently no-op.
        throw new Error('set_workspace_layout requires an owning agent session')
      }
      const chosen = layout as WorkspaceLayoutId
      exec.agent.session.append('workspace/layout', { layout: chosen })
      return Promise.resolve({
        result: `Workspace layout set to ${chosen} (${WORKSPACE_LAYOUT_PURPOSES[chosen]}). `
          + 'The person sees the new arrangement now and can leave it with one click.',
      })
    },
    presentCall: args => ({ card: 'generic', title: 'Set workspace layout', kind: 'other', rawInput: args }),
  }))
}
