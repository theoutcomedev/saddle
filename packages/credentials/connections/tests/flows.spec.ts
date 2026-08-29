// The generic api-key flow: register a service, run its flow against a mock
// surface that supplies the key, and read the committed record back.
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { AuthorizationService } from '@deepseek-ai/dsh-authorization'
import { CredentialProvider, parseCredentialKey } from '@deepseek-ai/dsh-credentials'
import type { CredentialKey, CredentialRecord, CredentialRef, CredentialRecordEntry } from '@deepseek-ai/dsh-credentials'
import { connectionKey, registerApiKeyConnection } from '../src/index.ts'

/** Minimal in-memory credential provider for exercising the flow. */
class MemoryCredentials extends CredentialProvider {
  private readonly refs = new Map<string, string>()
  private readonly records = new Map<string, CredentialRecord>()

  override resolve(ref: CredentialRef) {
    const value = this.refs.get(ref)
    return Promise.resolve(value === undefined ? undefined : { value, source: 'file' })
  }

  override describe(ref: CredentialRef) {
    return Promise.resolve(this.refs.has(ref)
      ? { configured: true, source: 'file', writable: true }
      : { configured: false, writable: true })
  }

  override async set(ref: CredentialRef, value: string): Promise<void> {
    this.refs.set(ref, value)
  }

  override async unset(ref: CredentialRef): Promise<void> {
    this.refs.delete(ref)
  }

  override readRecord(key: CredentialKey) {
    return Promise.resolve(this.records.get(key))
  }

  override describeRecord(key: CredentialKey) {
    const record = this.records.get(key)
    return Promise.resolve(record === undefined
      ? { configured: false, writable: true }
      : { configured: true, kind: record.kind, writable: true })
  }

  override listRecords(): Promise<readonly CredentialRecordEntry[]> {
    return Promise.resolve([...this.records].map(([key, record]) => ({
      key: parseCredentialKey(key),
      kind: record.kind,
    })))
  }

  override async modifyRecord(
    key: CredentialKey,
    mutate: (current: CredentialRecord | undefined) => Promise<CredentialRecord | undefined>,
  ): Promise<CredentialRecord | undefined> {
    const next = await mutate(this.records.get(key))
    if (next === undefined) return this.records.get(key)
    this.records.set(key, next)
    this.notifyRecordUpdated(key)
    return next
  }

  override async deleteRecord(key: CredentialKey): Promise<void> {
    this.records.delete(key)
  }
}

async function boot(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(MemoryCredentials)
  await ctx.plugin(AuthorizationService)
  return ctx
}

describe('registerApiKeyConnection', () => {
  it('registers a flow whose api-key method commits the typed key', async () => {
    const ctx = await boot()
    const connection = { id: 'supabase', label: 'Supabase', docsUrl: 'https://supabase.com/docs' }
    registerApiKeyConnection(ctx, connection)

    const entry = ctx.authorization.describe(connectionKey(connection))
    expect(entry?.label).toBe('Supabase')
    expect(entry?.methods).toEqual([{ id: 'api-key', label: 'API key' }])

    const outcome = await ctx.authorization.begin({
      key: connectionKey(connection),
      method: 'api-key',
      interaction: {
        notify: () => {},
        prompt: async (prompt) => {
          if (prompt.kind === 'secret') return 'sk-test'
          throw new Error(`unexpected prompt kind: ${prompt.kind}`)
        },
      },
    })
    expect(outcome).toEqual({ status: 'authorized' })
    expect(await ctx.credentials.readRecord(connectionKey(connection)))
      .toEqual({ kind: 'api-key', key: 'sk-test' })
  })
})
