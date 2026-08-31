// ConnectionsRuntime: the thin wire walk over the connections domain —
// list, connect, poll, answer, cancel, disconnect round-trip through a fake.
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ConnectionsRuntime } from '../src/client/connections/service.ts'
import { FakeApiClient } from './fake-api.client.ts'

async function setup() {
  const ctx = new Context()
  const api = new FakeApiClient()
  const runtime = new ConnectionsRuntime(ctx, api)
  return { ctx, api, runtime }
}

describe('ConnectionsRuntime', () => {
  it('lists flows and mcp servers through the wire', async () => {
    const { ctx, runtime } = await setup()
    const result = await runtime.list()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.flows).toEqual([])
      expect(result.value.mcp).toEqual([])
    }
    expect(ctx.connections).toBe(runtime)
  })

  it('walks one attempt: connect, poll, answer, cancel, disconnect', async () => {
    const { runtime } = await setup()
    const connect = await runtime.connect('connections/acme', 'api-key')
    expect(connect.ok).toBe(true)
    if (connect.ok) expect(connect.value.attemptId).toBe('a')
    const poll = await runtime.poll('a')
    expect(poll.ok).toBe(true)
    if (poll.ok) expect(poll.value.state).toBe('connecting')
    const answer = await runtime.answer('a', 'secret')
    expect(answer.ok).toBe(true)
    const cancel = await runtime.cancel('a')
    expect(cancel.ok).toBe(true)
    const disconnect = await runtime.disconnect('connections/acme')
    expect(disconnect.ok).toBe(true)
  })
})
