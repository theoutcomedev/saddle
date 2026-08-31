// Device-flow and OAuth (PKCE) connection flows: register a service, run its
// flow against a mock token endpoint (fetch stubbed), and read the committed
// grant record back.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { request } from 'node:http'
import { Context } from '@deepseek-ai/cordis'
import { AuthorizationService } from '@deepseek-ai/dsh-authorization'
import type { AuthorizationNotice, AuthorizationPrompt } from '@deepseek-ai/dsh-authorization'
import { CredentialProvider } from '@deepseek-ai/dsh-credentials'
import type { CredentialKey, CredentialRecord, CredentialRef } from '@deepseek-ai/dsh-credentials'
import { connectionKey, registerDeviceFlowConnection, registerOAuthConnection, registerToolService } from '../src/index.ts'
import { CATALOG, apply as registerCatalog } from '../src/startup.ts'

/** Minimal in-memory credential provider for exercising the flows. */
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
  read(key: CredentialKey): CredentialRecord | undefined { return this.records.get(key) }
}

/** Captures notices and answers prompts with a per-kind answer. */
function captureSurface() {
  const notices: AuthorizationNotice[] = []
  const prompts: AuthorizationPrompt[] = []
  const answers = new Map<string, string>()
  return {
    notices,
    prompts,
    answer(kind: string, value: string) { answers.set(kind, value) },
    interaction: {
      notify: (notice: AuthorizationNotice) => { notices.push(notice) },
      prompt: async (prompt: AuthorizationPrompt) => {
        prompts.push(prompt)
        const answer = answers.get(prompt.kind)
        if (answer === undefined) throw new Error('no answer registered for ' + prompt.kind)
        return answer
      },
    },
  }
}

/** Real-HTTP status probe for the loopback redirect (global fetch is stubbed). */
function getStatus(url: URL): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request(url, (response) => {
      response.resume()
      resolve(response.statusCode ?? 0)
    })
    req.on('error', reject)
    req.end()
  })
}

/** Stub global fetch with one responder keyed by URL suffix. */
function stubFetch(routes: Record<string, (form: URLSearchParams) => object>) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const suffix = Object.keys(routes).find(candidate => url.includes(candidate))
    if (suffix === undefined) return new Response('not found', { status: 404 })
    const body = init?.body instanceof URLSearchParams ? init.body : new URLSearchParams()
    return Response.json(routes[suffix]?.(body) ?? {})
  }))
}

afterEach(() => { vi.unstubAllGlobals() })

async function setup() {
  const ctx = new Context()
  await ctx.plugin(MemoryCredentials)
  await ctx.plugin(AuthorizationService)
  const credentials = ctx.credentials as MemoryCredentials
  return { ctx, credentials }
}

describe('device flow', () => {
  it('announces the page and code, polls, and commits the grant record', async () => {
    const { ctx, credentials } = await setup()
    let polls = 0
    stubFetch({
      '/device/code': () => ({
        device_code: 'DC-1',
        user_code: 'AB-12-CD',
        verification_uri: 'https://example.com/device',
        verification_uri_complete: 'https://example.com/device?user_code=AB-12-CD',
        interval: 0,
      }),
      '/device/token': (form) => {
        expect(form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:device_code')
        expect(form.get('device_code')).toBe('DC-1')
        polls += 1
        return polls < 3 ? { error: 'authorization_pending' } : { access_token: 'tok', refresh_token: 'ref', expires_in: 3600 }
      },
    })
    const dispose = registerDeviceFlowConnection(ctx, { id: 'acme', label: 'Acme' }, {
      authorizeUrl: 'https://example.com/device/code',
      tokenUrl: 'https://example.com/device/token',
      clientId: 'client',
      scope: 'read',
    })
    try {
      const surface = captureSurface()
      const outcome = await ctx.authorization.begin({
        key: connectionKey({ id: 'acme', label: 'Acme' }),
        method: 'device',
        interaction: surface.interaction,
      })
      expect(outcome.status).toBe('authorized')
      expect(surface.notices).toHaveLength(1)
      expect(surface.notices[0]?.code).toBe('AB-12-CD')
      expect(surface.notices[0]?.url).toContain('user_code=AB-12-CD')
      expect(polls).toBe(3)
      const record = credentials.read(connectionKey({ id: 'acme', label: 'Acme' }))
      expect(record).toMatchObject({
        kind: 'grant',
        payload: { type: 'oauth', accessToken: 'tok', refreshToken: 'ref', scope: 'read' },
      })
      expect(record && record.kind === 'grant' && (record.payload as { expiresAt?: number }).expiresAt).toBeTypeOf('number')
    } finally {
      dispose()
    }
  })

  it('fails with expired when the human never authorizes', async () => {
    const { ctx } = await setup()
    stubFetch({
      '/device/code': () => ({ device_code: 'DC', user_code: 'U', verification_uri: 'https://example.com/device', interval: 0 }),
      '/device/token': () => ({ error: 'authorization_pending' }),
    })
    const dispose = registerDeviceFlowConnection(ctx, { id: 'acme', label: 'Acme' }, {
      authorizeUrl: 'https://example.com/device/code',
      tokenUrl: 'https://example.com/device/token',
      clientId: 'client',
      timeoutMs: 20,
    })
    try {
      await expect(ctx.authorization.begin({
        key: connectionKey({ id: 'acme', label: 'Acme' }),
        method: 'device',
        interaction: captureSurface().interaction,
      })).rejects.toMatchObject({ code: 'expired' })
    } finally {
      dispose()
    }
  })

  it('answers cancelled when the attempt signal aborts mid-poll', async () => {
    const { ctx } = await setup()
    stubFetch({
      '/device/code': () => ({ device_code: 'DC', user_code: 'U', verification_uri: 'https://example.com/device', interval: 0 }),
      '/device/token': () => ({ error: 'authorization_pending' }),
    })
    const dispose = registerDeviceFlowConnection(ctx, { id: 'acme', label: 'Acme' }, {
      authorizeUrl: 'https://example.com/device/code',
      tokenUrl: 'https://example.com/device/token',
      clientId: 'client',
    })
    try {
      const controller = new AbortController()
      setTimeout(() => controller.abort(), 5)
      const outcome = await ctx.authorization.begin({
        key: connectionKey({ id: 'acme', label: 'Acme' }),
        method: 'device',
        interaction: captureSurface().interaction,
        signal: controller.signal,
      })
      expect(outcome.status).toBe('cancelled')
    } finally {
      dispose()
    }
  })
})

describe('oauth app flow', () => {
  it('manual-code mode exchanges the typed code and commits the grant', async () => {
    const { ctx, credentials } = await setup()
    stubFetch({
      '/oauth/token': (form) => {
        expect(form.get('grant_type')).toBe('authorization_code')
        expect(form.get('code_verifier')).toMatch(/^[A-Za-z0-9_-]+$/)
        expect(form.get('client_secret')).toBe('secret')
        return { access_token: 'at', refresh_token: 'rt' }
      },
    })
    const dispose = registerOAuthConnection(ctx, { id: 'acme', label: 'Acme' }, {
      authorizeUrl: 'https://example.com/oauth/authorize',
      tokenUrl: 'https://example.com/oauth/token',
      clientId: 'client',
      clientSecret: 'secret',
      scope: 'write',
      redirectMode: 'manual-code',
    })
    try {
      const surface = captureSurface()
      surface.answer('text', 'CODE-123')
      const outcome = await ctx.authorization.begin({
        key: connectionKey({ id: 'acme', label: 'Acme' }),
        method: 'oauth',
        interaction: surface.interaction,
      })
      expect(outcome.status).toBe('authorized')
      expect(surface.notices[0]?.url).toContain('response_type=code')
      expect(surface.notices[0]?.url).toContain('code_challenge=')
      expect(surface.notices[0]?.url).toContain('code_challenge_method=S256')
      const record = credentials.read(connectionKey({ id: 'acme', label: 'Acme' }))
      expect(record).toMatchObject({
        kind: 'grant',
        payload: { type: 'oauth', accessToken: 'at', refreshToken: 'rt', scope: 'write' },
      })
    } finally {
      dispose()
    }
  })

  it('loopback mode completes when the redirect arrives with a matching state', async () => {
    const { ctx, credentials } = await setup()
    stubFetch({
      '/oauth/token': (form) => {
        expect(form.get('code')).toBe('CB-1')
        expect(form.get('code_verifier')).toMatch(/^[A-Za-z0-9_-]+$/)
        return { access_token: 'at2' }
      },
    })
    const dispose = registerOAuthConnection(ctx, { id: 'acme', label: 'Acme' }, {
      authorizeUrl: 'https://example.com/oauth/authorize',
      tokenUrl: 'https://example.com/oauth/token',
      clientId: 'client',
      redirectMode: 'loopback',
      redirectPort: 0,
    })
    try {
      const surface = captureSurface()
      const begin = ctx.authorization.begin({
        key: connectionKey({ id: 'acme', label: 'Acme' }),
        method: 'oauth',
        interaction: surface.interaction,
      })
      // Wait for the flow to announce its loopback URL, then deliver the code.
      await vi.waitFor(() => { expect(surface.notices.length).toBe(1) })
      const url = new URL(surface.notices[0]?.url ?? '')
      const state = url.searchParams.get('state') ?? ''
      const loopback = new URL(url.searchParams.get('redirect_uri') ?? '')
      loopback.searchParams.set('state', state)
      loopback.searchParams.set('code', 'CB-1')
      const status = await getStatus(loopback)
      expect(status).toBe(200)
      const outcome = await begin
      expect(outcome.status).toBe('authorized')
      const record = credentials.read(connectionKey({ id: 'acme', label: 'Acme' }))
      expect(record).toMatchObject({ kind: 'grant', payload: { type: 'oauth', accessToken: 'at2' } })
    } finally {
      dispose()
    }
  })
})

describe('shipped catalog', () => {
  it('registers one api-key flow per catalog service and withdraws on dispose', async () => {
    const { ctx } = await setup()
    const dispose = registerCatalog(ctx)
    try {
      const flows = ctx.authorization.list()
      expect(flows.map(flow => flow.key)).toEqual(CATALOG.map(connection => connectionKey(connection)))
      for (const connection of CATALOG) {
        const entry = ctx.authorization.describe(connectionKey(connection))
        expect(entry?.methods[0]?.id).toBe('api-key')
        expect(entry?.docsUrl).toBe(connection.docsUrl)
      }
      const twilio = ctx.authorization.describe(connectionKey(CATALOG.find(s => s.id === 'twilio') as never))
      expect(twilio?.fields?.length).toBe(2)
    } finally {
      dispose()
    }
    expect(ctx.authorization.list()).toHaveLength(0)
  })
})

describe('tool service registration', () => {
  it('prompts once per named field and commits the values keyed by id', async () => {
    const { ctx, credentials } = await setup()
    const dispose = registerToolService(ctx, {
      id: 'twilio',
      label: 'Twilio',
      docsUrl: 'https://console.twilio.com/',
      auth: { method: 'api-key', fields: [
        { id: 'accountSid', label: 'Account SID' },
        { id: 'authToken', label: 'Auth Token' },
      ] },
    })
    try {
      // Two prompts, answered in order (a kind-keyed surface would feed both
      // the same value, which the real UI never does).
      const values = ['AC123', 'tok-456']
      let index = 0
      const interaction = {
        notify: () => {},
        prompt: async () => values[index++] ?? '',
      }
      const outcome = await ctx.authorization.begin({
        key: connectionKey({ id: 'twilio', label: 'Twilio' }),
        method: 'api-key',
        interaction,
      })
      expect(outcome.status).toBe('authorized')
      expect(index).toBe(2)
      const record = credentials.read(connectionKey({ id: 'twilio', label: 'Twilio' }))
      expect(record && record.kind === 'grant' && (record.payload as { values?: unknown }).values)
        .toEqual({ accountSid: 'AC123', authToken: 'tok-456' })
    } finally {
      dispose()
    }
  })
})
