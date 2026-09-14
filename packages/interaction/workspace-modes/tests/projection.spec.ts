/**
 * The `workspaceLayout` projection provider: the browser half reads the shape a
 * session asked for through this key, so what matters here is that it serves
 * the LAST request, carries the sequence that recorded it (the only way a
 * renderer tells two requests for the same layout apart), starts as null, is
 * absent in a composition without this package, and disappears when the fiber
 * unloads (HMR safety). The carrier and the framework run unmodified.
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import SessionStore from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import type { RpcRequest } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { createApiProxy } from '@deepseek-ai/dsh-host-apiproxy'
import * as WorkspaceModes from '@deepseek-ai/dsh-workspace-modes'

let nextRpc = 1
function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`workspace-layout-proj-${String(nextRpc++)}`), payload }
}

interface Bench {
  ctx: Context
  session: Session
  tailProjections(): Promise<{ asOfSeq: number; values: Record<string, unknown> } | undefined>
}

async function harness(withLayouts: boolean): Promise<Bench> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt, { persona: '' })
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(UserQuestionService)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(SessionProjectionRegistry)
  if (withLayouts) await ctx.plugin(WorkspaceModes)
  const session = ctx.sessions.create()
  ctx.agents.register({ id: session.id, session, status: 'idle', ctx } as Agent)
  const api = createApiProxy(ctx, { defaultModelSelection: () => ({ provider: 'p', model: 'm' }), cwd: '/tmp' })
  return {
    ctx,
    session,
    async tailProjections() {
      const response = await api.sessions.history(request({ sessionId: session.id }))
      if (!response.result.ok) throw new Error('history failed')
      return response.result.value.projections
    },
  }
}

/** One paginable message so the tail page is non-degenerate. */
function seedMessage(session: Session): void {
  session.append('user/message', createUserMessage({
    content: [{ type: 'text', text: 'hi' }],
    source: { kind: 'user' },
  }), { surfaceOp: 'append' })
}

describe('the workspaceLayout projection provider', () => {
  it('serves null before the session asks for a shape', async () => {
    const bench = await harness(true)
    seedMessage(bench.session)
    const projections = await bench.tailProjections()
    expect(projections?.values.workspaceLayout).toBeNull()
    expect(projections?.asOfSeq).toBe(bench.session.seq - 1)
  })

  it('serves the last request with the sequence that recorded it', async () => {
    const bench = await harness(true)
    seedMessage(bench.session)
    bench.session.append('workspace/layout', { layout: 'focus' })
    bench.session.append('workspace/layout', { layout: 'zen' })
    const projections = await bench.tailProjections()
    expect(projections?.values.workspaceLayout).toEqual({ layout: 'zen', at: bench.session.seq - 1 })
  })

  it('tells two requests for the same layout apart', async () => {
    // The chip consumes an instruction by its sequence: without that, asking
    // for a layout the person has since left would be indistinguishable from the
    // request that entered it.
    const bench = await harness(true)
    seedMessage(bench.session)
    bench.session.append('workspace/layout', { layout: 'zen' })
    const first = await bench.tailProjections()
    bench.session.append('workspace/layout', { layout: 'zen' })
    const second = await bench.tailProjections()
    const firstState = first?.values.workspaceLayout as { at: number } | undefined
    const secondState = second?.values.workspaceLayout as { at: number } | undefined
    expect(secondState?.at).toBeGreaterThan(firstState?.at ?? -1)
  })

  it('has no key in a composition without this package', async () => {
    const bench = await harness(false)
    seedMessage(bench.session)
    const projections = await bench.tailProjections()
    expect('workspaceLayout' in (projections?.values ?? {})).toBe(false)
  })

  it('drops the key when the fiber unloads', async () => {
    const bench = await harness(false)
    seedMessage(bench.session)
    const fiber = await bench.ctx.plugin(WorkspaceModes)
    expect((await bench.tailProjections())?.values.workspaceLayout).toBeNull()
    await fiber.dispose()
    expect('workspaceLayout' in ((await bench.tailProjections())?.values ?? {})).toBe(false)
  })
})
