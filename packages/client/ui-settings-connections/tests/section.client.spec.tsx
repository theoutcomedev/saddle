// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { IConnections } from '@deepseek-ai/dsh-client-runtime/client'
import { ConnectionsSection } from '../src/client/ConnectionsSection.tsx'
import type { ConnectionsKey } from '../src/client/locales.ts'

const okList = {
  ok: true as const,
  value: {
    flows: [
      { key: 'connections/supabase', label: 'Supabase', methods: [{ id: 'api-key', label: 'API key' }], configured: false, inFlight: false },
      { key: 'connections/openai', label: 'OpenAI', methods: [{ id: 'api-key', label: 'API key' }], configured: true, inFlight: false },
    ],
    mcp: [{ serverName: 'filesystem', state: 'ready' }],
  },
}

const fakeConnections = {
  list: async () => okList,
  connect: async () => ({ ok: true as const, value: { attemptId: 'a' } }),
  poll: async () => ({ ok: true as const, value: { state: 'connecting' } as const }),
  answer: async () => ({ ok: true as const, value: {} }),
  cancel: async () => ({ ok: true as const, value: {} }),
  disconnect: async () => ({ ok: true as const, value: {} }),
} as unknown as IConnections

const t = (k: ConnectionsKey): string => k

afterEach(() => cleanup())

describe('ConnectionsSection', () => {
  it('renders the flow rows and MCP card after the list resolves', async () => {
    await act(async () => {
      render(<ConnectionsSection connections={fakeConnections} t={t} />)
    })
    expect(await screen.findByText('Supabase')).toBeTruthy()
    expect(screen.getByText('OpenAI')).toBeTruthy()
    expect(screen.getByText('filesystem')).toBeTruthy()
    expect(screen.getByText('connected')).toBeTruthy()
  })

  it('renders an error message when the list fails', async () => {
    const failing = { ...fakeConnections, list: async () => ({ ok: false as const, error: { code: 'internal' as const, message: 'boom', details: {} } }) } as unknown as IConnections
    await act(async () => {
      render(<ConnectionsSection connections={failing} t={t} />)
    })
    expect(await screen.findByText(/boom/)).toBeTruthy()
  })
})
