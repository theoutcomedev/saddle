// The request_credential tool: register the api-key flow on demand, surface the
// masked prompt through user-questions, and commit the typed key.
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { CallId } from '@deepseek-ai/dsh-llm'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import type { AskUserQuestionRequest } from '@deepseek-ai/dsh-user-questions'
import { AuthorizationService } from '@deepseek-ai/dsh-authorization'
import { CredentialProvider } from '@deepseek-ai/dsh-credentials'
import type { CredentialKey, CredentialRecord, CredentialRef } from '@deepseek-ai/dsh-credentials'
import { connectionKey } from '../src/index.ts'
import * as connections from '../src/tool.ts'
import { interactionFor, questionFor } from '../src/tool.ts'

class MemoryCredentials extends CredentialProvider {
  private readonly records = new Map<string, CredentialRecord>()

  override resolve(_ref: CredentialRef) { return Promise.resolve(undefined) }
  override describe(_ref: CredentialRef) { return Promise.resolve({ configured: false, writable: true }) }
  override async set(_ref: CredentialRef, _value: string): Promise<void> {}
  override async unset(_ref: CredentialRef): Promise<void> {}
  override readRecord(key: CredentialKey) { return Promise.resolve(this.records.get(key)) }
  override describeRecord(key: CredentialKey) {
    const record = this.records.get(key)
    return Promise.resolve(record === undefined
      ? { configured: false, writable: true }
      : { configured: true, kind: record.kind, writable: true })
  }

  override listRecords() { return Promise.resolve([]) }
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

  override async deleteRecord(_key: CredentialKey): Promise<void> {}
}

async function setup() {
  const ctx = new Context()
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(UserQuestionService)
  await ctx.plugin(MemoryCredentials)
  await ctx.plugin(AuthorizationService)
  await ctx.plugin(connections)
  return ctx
}

describe('request_credential tool', () => {
  it('surfaces the masked prompt and commits the typed key', async () => {
    const ctx = await setup()
    const seen: AskUserQuestionRequest[] = []
    ctx.userQuestions.registerProvider({
      async ask(request) {
        seen.push(request)
        return { answers: [{ id: 'credential', selected: [], custom: 'sk-supabase' }] }
      },
    })

    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('cred-1'),
      name: 'request_credential',
      arguments: { service: 'supabase', label: 'Supabase' },
    })

    expect(result.isError).toBe(false)
    expect(seen[0]?.questions[0]).toMatchObject({ id: 'credential', secret: true })
    expect(await ctx.credentials.readRecord(connectionKey({ id: 'supabase', label: 'Supabase' })))
      .toEqual({ kind: 'api-key', key: 'sk-supabase' })
  })

  it('maps every prompt kind and survives an empty answer', async () => {
    const ctx = await setup()
    ctx.userQuestions.registerProvider({
      async ask() { return { answers: [] } },
    })

    expect(questionFor({ kind: 'text', message: 'Type something' })).toEqual({ id: 'credential', question: 'Type something' })
    expect(questionFor({
      kind: 'select',
      message: 'Pick one',
      options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', description: 'the second' }],
    })).toEqual({
      id: 'credential',
      question: 'Pick one',
      options: [{ label: 'A' }, { label: 'B', description: 'the second' }],
    })

    const interaction = interactionFor(ctx)
    interaction.notify({ message: 'progress' })
    expect(await interaction.prompt({ kind: 'secret', message: 'Key' })).toBe('')
  })

  it('rejects a bad service id and reuses an already-registered flow', async () => {
    const ctx = await setup()
    ctx.userQuestions.registerProvider({
      async ask() { return { answers: [{ id: 'credential', selected: [], custom: 'sk' }] } },
    })
    const signal = new AbortController().signal

    const bad = await ctx.tools.execute({
      signal, callId: CallId('bad'), name: 'request_credential', arguments: { service: 'Not Valid!' },
    })
    expect(bad.isError).toBe(true)

    const first = await ctx.tools.execute({
      signal, callId: CallId('c1'), name: 'request_credential',
      arguments: { service: 'resend', docs_url: 'https://resend.com/docs' },
    })
    expect(first.isError).toBe(false)

    const second = await ctx.tools.execute({
      signal, callId: CallId('c2'), name: 'request_credential', arguments: { service: 'resend' },
    })
    expect(second.isError).toBe(false)
  })
})
