// Probes for the connections section's inject path: ctx.connections must
// resolve from a child plugin context (the section plugin's ctx), the same
// way ctx.workspaces does.
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ConnectionsRuntime } from '../src/client/connections/service.ts'
import { FakeApiClient } from './fake-api.client.ts'

describe('ctx.connections resolution', () => {
  it('resolves from a child plugin context after ConnectionsRuntime provides it', async () => {
    const ctx = new Context()
    const runtime = new ConnectionsRuntime(ctx, new FakeApiClient())
    const seen: unknown[] = []
    const probe = {
      name: 'probe',
      inject: [] as string[],
      apply: (child: Context): void => {
        seen.push(child.connections)
      },
    }
    await ctx.plugin(probe)
    expect(seen).toHaveLength(1)
    expect(seen[0]).toBe(runtime)
  })
})
