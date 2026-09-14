/**
 * Workspace modes on the host side: the model-facing tool that changes the
 * shape of a session's screen, and the durable record of what it asked for.
 *
 * The tool writes one `workspace/mode` event and nothing else — the browser
 * half reads the fold of that event through the `workspaceMode` projection and
 * arranges the shell, which keeps the request in the log, replayable, and
 * identical across a reload or a second tab. A non-agent caller has no session
 * to record into and is rejected.
 *
 * @module @deepseek-ai/dsh-workspace-modes
 */

import type { Context } from '@deepseek-ai/cordis'
import { z as zod } from 'zod'
import type { ZodType } from 'zod'
import { defineTool } from '@deepseek-ai/dsh-tools'
// Type-only: resolves ctx.sessionProjections for the optional unit child.
import type {} from '@deepseek-ai/dsh-session-projection'
import { WORKSPACE_MODES, WORKSPACE_MODE_PURPOSES } from './catalogue.ts'
import type { WorkspaceModeId, WorkspaceModeState } from './types.ts'

// The `workspaceMode` projection-key declaration lives in src/types.ts (its one
// home); this re-export projects the type face onto the package root AND keeps
// the module edge in the emitted index.d.ts, so aggregate programs consuming
// the declarations still receive the SessionProjectionMap merge.
export type * from './types.ts'

// The catalogue is public: the browser package's spec reads the accepted ids
// beside its own arrangements, which is what keeps the two halves together.
export { WORKSPACE_MODES, WORKSPACE_MODE_PURPOSES } from './catalogue.ts'

export const name = 'workspace-modes'
export const inject = ['tools']

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * The shape this session asked its screen to take: log-only, non-surface,
     * whole-value replace. The last `workspace/mode` wins, and the span between
     * two of them is the sequence a renderer uses to tell two requests for the
     * same mode apart. The browser half consumes it through the
     * `workspaceMode` projection; the model sees only the tool result.
     */
    'workspace/mode': { mode: WorkspaceModeId }
  }
}

/** Wire payload schema of the `workspaceMode` projection (a recorded request, or pre-first-request null). */
const workspaceModeSchema: ZodType<WorkspaceModeState | null> = zod.union([
  zod.object({
    mode: zod.union([zod.literal('standard'), zod.literal('focus'), zod.literal('zen')]),
    at: zod.number().int().nonnegative(),
  }),
  zod.null(),
])

/** The tool's model-facing description, derived from the catalogue. */
function describe(): string {
  const lines = WORKSPACE_MODES.map(mode => `- ${mode}: ${WORKSPACE_MODE_PURPOSES[mode]}`).join('\n')
  return 'Rearrange the person\'s screen for the shape the work wants. A mode decides which panels '
    + 'are out, how much room the pane beside the work gets, and how wide the reading measure is. '
    + `Available modes:\n${lines}\n`
    + 'Use it when the request or the work clearly suits a shape — a long writing or reading pass, a '
    + 'review that wants the pane beside the document, or a return to the plain shell. The change '
    + 'applies at once for the session in view, it closes nothing and interrupts nothing, and the '
    + 'person can leave the mode with one click.'
}

/**
 * Register the `set_workspace_mode` tool and, when the session-projection seam
 * is composed, the `workspaceMode` unit.
 * @param ctx - registrant context carrying the tool registry.
 */
export function apply(ctx: Context): void {
  // The unit child activates only when a projection registry is composed
  // (headless assemblies stay unaffected). Last-wins fold; every other event
  // returns the same state reference, which is the registry's change gate.
  ctx.inject(['sessionProjections'], (projectionCtx) => {
    projectionCtx.sessionProjections.register<'workspaceMode', WorkspaceModeState | null>({
      key: 'workspaceMode',
      stateSchema: workspaceModeSchema,
      init: () => null,
      apply: (state, event) => event.type === 'workspace/mode'
        ? { mode: event.data.mode, at: event.seq }
        : state,
      wire: { viewSchema: workspaceModeSchema, view: state => state },
      stateVersion: 1,
    })
  })

  ctx.tools.register(defineTool({
    name: 'set_workspace_mode',
    description: describe(),
    parameters: {
      mode: {
        type: 'string',
        required: true,
        enum: [...WORKSPACE_MODES],
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
      const mode = args.mode
      // The schema enum and the catalogue are one list, but the model boundary
      // is still a boundary: an unknown id would otherwise be written into the
      // log and shown as an unknown mode by every client.
      if (!(WORKSPACE_MODES as readonly string[]).includes(mode)) {
        throw new Error(`unknown workspace mode "${mode}"; expected one of ${WORKSPACE_MODES.join(', ')}`)
      }
      if (!exec.agent) {
        // The request belongs to a session's log; a caller without an owning
        // session has nowhere to record it. Reject rather than silently no-op.
        throw new Error('set_workspace_mode requires an owning agent session')
      }
      const chosen = mode as WorkspaceModeId
      exec.agent.session.append('workspace/mode', { mode: chosen })
      return Promise.resolve({
        result: `Workspace mode set to ${chosen} (${WORKSPACE_MODE_PURPOSES[chosen]}). `
          + 'The person sees the new arrangement now and can leave it with one click.',
      })
    },
    presentCall: args => ({ card: 'generic', title: 'Set workspace mode', kind: 'other', rawInput: args }),
  }))
}
