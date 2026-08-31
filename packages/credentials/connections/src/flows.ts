/**
 * OAuth-family connection flows beyond the generic api-key: the device
 * authorization grant (RFC 8628 — the human opens a page and types a code,
 * the client polls until the grant lands) and the authorization-code grant
 * with PKCE (the human authorizes in a browser and the code comes back either
 * through a loopback redirect or by hand). Both commit their token as a
 * {@link GrantRecord} whose payload only the owning connection interprets.
 *
 * Each registration is the whole of "connect this service" — the same
 * single-writer contract every authorization flow holds: run() resolves
 * only after ctx.credentials.modifyRecord committed the token.
 * @module @deepseek-ai/dsh-connections/flows
 */

import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { AuthorizationSession } from '@deepseek-ai/dsh-authorization'
import type { CredentialKey } from '@deepseek-ai/dsh-credentials'
import { connectionKey, type ApiKeyConnection } from './index.ts'

/** One OAuth device authorization grant (RFC 8628). */
export interface DeviceFlowEndpoints {
  /** Endpoint accepting client_id and returning the device and user codes. */
  authorizeUrl: string
  /** Endpoint polled with the device code until the human authorizes. */
  tokenUrl: string
  /** The client this flow authorizes as. */
  clientId: string
  /** OAuth scope requested. */
  scope?: string
  /** Extra form fields appended to the authorize request (e.g. a client_secret). */
  extraAuthorizeParams?: Record<string, string>
  /** Seconds between token polls; the endpoint's interval wins when present. Default: 5. */
  pollIntervalSeconds?: number
  /** How long the flow waits for the human to authorize before failing. Default: 15 minutes. */
  timeoutMs?: number
}

/** One OAuth authorization-code grant with PKCE. */
export interface OAuthAppEndpoints {
  /** Endpoint the human opens to authorize. */
  authorizeUrl: string
  /** Endpoint exchanging the code for a token. */
  tokenUrl: string
  /** The public client this flow authorizes as. */
  clientId: string
  /** Client secret; omit for a public client (PKCE covers the proof of possession). */
  clientSecret?: string
  /** OAuth scope requested. */
  scope?: string
  /** How the authorization response is captured. */
  redirectMode: 'loopback' | 'manual-code'
  /** Loopback port to listen on; default picks an ephemeral port. Only for loopback. */
  redirectPort?: number
  /** How long the flow waits for the human to authorize before failing. Default: 10 minutes. */
  timeoutMs?: number
}

/** A device or OAuth flow failed before committing a token. */
export class ConnectionFlowError extends Error {
  /** Stable failure code a surface can key copy off. */
  readonly code: 'expired' | 'declined' | 'response' | 'network'

  constructor(code: ConnectionFlowError['code'], message: string) {
    super(message)
    this.code = code
  }
}

/** How long a device flow waits for the human before giving up. */
const DEVICE_FLOW_DEFAULT_TIMEOUT_MS = 15 * 60 * 1000
/** How long an OAuth flow waits for the human before giving up. */
const OAUTH_FLOW_DEFAULT_TIMEOUT_MS = 10 * 60 * 1000
/** Default seconds between device-code token polls. */
const DEFAULT_DEVICE_POLL_INTERVAL_SECONDS = 5

/**
 * Register one device authorization flow (RFC 8628) for a service.
 * @param ctx - the plugin context carrying ctx.authorization and ctx.credentials.
 * @param connection - the service to connect (id, label, docs link).
 * @param endpoints - the grant's endpoints and client identity.
 * @returns a disposer that withdraws the flow.
 */
export function registerDeviceFlowConnection(
  ctx: Context,
  connection: ApiKeyConnection,
  endpoints: DeviceFlowEndpoints,
): () => void {
  const key = connectionKey(connection)
  return ctx.authorization.registerFlow({
    key,
    label: connection.label,
    methods: [{ id: 'device', label: 'Sign in with device code' }],
    async run(session) {
      await runDeviceFlow(ctx, key, connection.label, endpoints, session)
    },
  })
}

/**
 * Register one authorization-code flow with PKCE for a service.
 * @param ctx - the plugin context carrying ctx.authorization and ctx.credentials.
 * @param connection - the service to connect (id, label, docs link).
 * @param endpoints - the grant's endpoints, client identity, and redirect capture mode.
 * @returns a disposer that withdraws the flow.
 */
export function registerOAuthConnection(
  ctx: Context,
  connection: ApiKeyConnection,
  endpoints: OAuthAppEndpoints,
): () => void {
  const key = connectionKey(connection)
  return ctx.authorization.registerFlow({
    key,
    label: connection.label,
    methods: [{ id: 'oauth', label: 'Sign in with browser' }],
    async run(session) {
      await runOAuthFlow(ctx, key, connection.label, endpoints, session)
    },
  })
}

/** Run one device grant: announce the page and code, then poll for the token. */
async function runDeviceFlow(
  ctx: Context,
  key: CredentialKey,
  label: string,
  endpoints: DeviceFlowEndpoints,
  session: AuthorizationSession,
): Promise<void> {
  const authorizeForm = new URLSearchParams({ client_id: endpoints.clientId })
  if (endpoints.scope !== undefined) authorizeForm.set('scope', endpoints.scope)
  for (const [name, value] of Object.entries(endpoints.extraAuthorizeParams ?? {})) {
    authorizeForm.set(name, value)
  }
  const authorize = await postForm(endpoints.authorizeUrl, authorizeForm, session.signal, 'device authorization')
  const deviceCode = authorize['device_code']
  const userCode = authorize['user_code']
  const verificationUri = authorize['verification_uri']
  if (typeof deviceCode !== 'string' || typeof userCode !== 'string' || typeof verificationUri !== 'string') {
    throw new ConnectionFlowError('response', 'device authorization endpoint answered without device/user codes')
  }
  const completeUri = authorize['verification_uri_complete']
  session.notify({
    message: 'Authorize ' + label + ': open the page and enter the code.',
    url: typeof completeUri === 'string' ? completeUri : verificationUri,
    code: userCode,
  })
  const intervalMs = (numberField(authorize['interval'], undefined) ?? DEFAULT_DEVICE_POLL_INTERVAL_SECONDS) * 1000
  const deadline = Date.now() + (endpoints.timeoutMs ?? DEVICE_FLOW_DEFAULT_TIMEOUT_MS)
  const pollForm = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code: deviceCode,
    client_id: endpoints.clientId,
  })
  for (;;) {
    if (session.signal.aborted) {
      throw new ConnectionFlowError('declined', 'device authorization was cancelled')
    }
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      throw new ConnectionFlowError('expired', 'device authorization timed out before the code was entered')
    }
    await sleep(Math.min(intervalMs, remaining), session.signal)
    const token = await postForm(endpoints.tokenUrl, pollForm, session.signal, 'device token')
    if (typeof token['access_token'] === 'string') {
      await commitToken(ctx, key, token, endpoints.scope)
      return
    }
    const error = token['error']
    if (error === 'authorization_pending' || error === 'slow_down') continue
    if (error === 'expired_token' || error === 'access_denied') {
      throw new ConnectionFlowError('expired', 'device authorization ' + String(error))
    }
    throw new ConnectionFlowError('response', 'device token endpoint answered ' + String(error ?? 'an unknown error'))
  }
}

/** Run one authorization-code grant: announce the authorize URL, capture the code, exchange it. */
async function runOAuthFlow(
  ctx: Context,
  key: CredentialKey,
  label: string,
  endpoints: OAuthAppEndpoints,
  session: AuthorizationSession,
): Promise<void> {
  const verifier = base64Url(randomBytes(48))
  const challenge = base64Url(createHash('sha256').update(verifier).digest())
  const state = base64Url(randomBytes(18))
  const timeoutMs = endpoints.timeoutMs ?? OAUTH_FLOW_DEFAULT_TIMEOUT_MS
  const loopback = endpoints.redirectMode === 'loopback'
    ? startLoopback(endpoints.redirectPort ?? 0, state, session.signal, timeoutMs)
    : undefined
  const redirectUri = loopback === undefined ? undefined : await loopback.redirectUri
  const authorizeParams = new URLSearchParams({
    response_type: 'code',
    client_id: endpoints.clientId,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  if (redirectUri !== undefined) authorizeParams.set('redirect_uri', redirectUri)
  if (endpoints.scope !== undefined) authorizeParams.set('scope', endpoints.scope)
  session.notify({
    message: 'Authorize ' + label + ' in your browser, then return here.',
    url: endpoints.authorizeUrl + '?' + authorizeParams.toString(),
  })
  let code: string
  if (loopback === undefined) {
    code = await session.prompt({ kind: 'text', message: 'Enter the code shown after authorizing ' + label + '.' })
  } else {
    code = await loopback.code
  }
  const exchangeForm = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: endpoints.clientId,
    code_verifier: verifier,
  })
  if (redirectUri !== undefined) exchangeForm.set('redirect_uri', redirectUri)
  if (endpoints.clientSecret !== undefined) exchangeForm.set('client_secret', endpoints.clientSecret)
  const token = await postForm(endpoints.tokenUrl, exchangeForm, session.signal, 'token')
  if (typeof token['access_token'] !== 'string') {
    throw new ConnectionFlowError('response', 'token endpoint answered ' + String(token['error'] ?? 'an unknown error'))
  }
  await commitToken(ctx, key, token, endpoints.scope)
}

/** Commit an OAuth token response as this connection's grant record. */
async function commitToken(
  ctx: Context,
  key: CredentialKey,
  token: Record<string, unknown>,
  scope: string | undefined,
): Promise<void> {
  const expiresIn = numberField(token['expires_in'], undefined)
  await ctx.credentials.modifyRecord(key, () => Promise.resolve({
    kind: 'grant',
    payload: {
      type: 'oauth',
      accessToken: String(token['access_token']),
      ...typeof token['refresh_token'] === 'string' ? { refreshToken: token['refresh_token'] } : {},
      ...expiresIn === undefined ? {} : { expiresAt: Date.now() + expiresIn * 1000 },
      ...scope === undefined ? {} : { scope },
    },
  }))
}

/** POST a form body and parse the JSON answer, mapping transport failures. */
async function postForm(
  url: string,
  form: URLSearchParams,
  signal: AbortSignal,
  what: string,
): Promise<Record<string, unknown>> {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: form,
      signal,
    })
  } catch (error: unknown) {
    throw new ConnectionFlowError('network', what + ' request failed: ' + (error instanceof Error ? error.message : String(error)))
  }
  if (!response.ok) {
    throw new ConnectionFlowError('response', what + ' endpoint answered HTTP ' + response.status)
  }
  const value: unknown = await response.json().catch(() => undefined)
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ConnectionFlowError('response', what + ' endpoint answered non-JSON content')
  }
  return value as Record<string, unknown>
}

/** The loopback redirect capture: the bound redirect URI plus the code promise. */
interface LoopbackCapture {
  /** The redirect_uri the authorize URL must carry; resolves once the server is listening. */
  redirectUri: Promise<string>
  /** Resolves with the code the redirect delivers, or rejects on timeout/abort/error. */
  code: Promise<string>
}

/** Listen on loopback until the authorize redirect delivers the code. */
function startLoopback(
  port: number,
  expectedState: string,
  signal: AbortSignal,
  timeoutMs: number,
): LoopbackCapture {
  let settlePort!: (port: number) => void
  const redirectUri = new Promise<string>((resolve) => {
    settlePort = (port: number) => resolve('http://127.0.0.1:' + port + '/')
  })
  const code = new Promise<string>((resolve, reject) => {
    const server = createServer((request, response) => {
      const target = new URL(request.url ?? '/', 'http://127.0.0.1')
      if (target.searchParams.get('state') !== expectedState) {
        response.writeHead(400, { 'content-type': 'text/plain' })
        response.end('state mismatch')
        return
      }
      const code = target.searchParams.get('code')
      if (code === null) {
        response.writeHead(400, { 'content-type': 'text/plain' })
        response.end('missing code')
        return
      }
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end('<p>Authorization complete — you can close this tab.</p>')
      cleanup()
      resolve(code)
    })
    const timer = setTimeout(() => {
      cleanup()
      reject(new ConnectionFlowError('expired', 'oauth authorization timed out before the redirect arrived'))
    }, timeoutMs)
    const onAbort = (): void => {
      cleanup()
      reject(new ConnectionFlowError('declined', 'oauth authorization was cancelled'))
    }
    const cleanup = (): void => {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      server.close()
    }
    signal.addEventListener('abort', onAbort, { once: true })
    server.on('error', (error: unknown) => {
      cleanup()
      reject(new ConnectionFlowError('network', 'loopback redirect server failed: ' + (error instanceof Error ? error.message : String(error))))
    })
    server.listen(port, '127.0.0.1', () => {
      const address = server.address()
      const boundPort = typeof address === 'object' && address !== null ? address.port : port
      settlePort(boundPort)
    })
  })
  return { redirectUri, code }
}

/** Base64url without padding, for PKCE material. */
function base64Url(bytes: Buffer): string {
  return bytes.toString('base64url')
}

/** The endpoint's numeric field when present and numeric; otherwise the fallback. */
function numberField(value: unknown, fallback: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Sleep, aborting early on the attempt's signal. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new ConnectionFlowError('declined', 'device authorization was cancelled'))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}
