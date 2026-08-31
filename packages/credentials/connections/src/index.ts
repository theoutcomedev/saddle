/**
 * Service connections: a generic api-key authorization flow. Any service that
 * authenticates with a single secret becomes a connection by registering its
 * id, label, and docs link; the flow prompts for the key — masked by the
 * authorization seam's `secret` prompt and kept out of logs — and commits it
 * as an `api-key` credential record.
 *
 * The caller (a plugin) declares `inject: ['authorization']`; the authorization
 * seam itself requires `credentials`, so both `ctx.authorization` and
 * `ctx.credentials` are present here.
 * @module @deepseek-ai/dsh-connections
 */

import type { Context } from '@deepseek-ai/cordis'
import type { AuthorizationMethod } from '@deepseek-ai/dsh-authorization'
import { credentialKey } from '@deepseek-ai/dsh-credentials'
import type { CredentialKey } from '@deepseek-ai/dsh-credentials'

/** The scope every connection record lives under. */
export const CONNECTION_SCOPE = 'connections'

/** One service the generic api-key flow can connect. */
export interface ApiKeyConnection {
  /** Stable service id; a lowercase hyphenated identifier (a {@link CredentialKey} segment). */
  id: string
  /** Human-facing service name. */
  label: string
  /** Provider API/docs link a surface shows beside the connect action. */
  docsUrl?: string
}

/** The credential record address one connection writes. */
export function connectionKey(connection: ApiKeyConnection): CredentialKey {
  return credentialKey(CONNECTION_SCOPE, connection.id)
}

/**
 * Register a generic api-key authorization flow for one service. The flow is
 * the whole of "connect this service": it asks for the key, then commits the
 * record — the same single-writer contract every authorization flow holds.
 * @param ctx - the plugin context carrying `ctx.authorization` and `ctx.credentials`.
 * @param connection - the service to connect.
 * @returns a disposer that withdraws the flow.
 */
export function registerApiKeyConnection(ctx: Context, connection: ApiKeyConnection): () => void {
  const key = connectionKey(connection)
  const methods: readonly [AuthorizationMethod, ...AuthorizationMethod[]] = [
    { id: 'api-key', label: 'API key' },
  ]
  return ctx.authorization.registerFlow({
    key,
    label: connection.label,
    methods,
    async run(session) {
      const value = await session.prompt({
        kind: 'secret',
        message: `Enter the ${connection.label} API key`,
      })
      await ctx.credentials.modifyRecord(key, () => Promise.resolve({ kind: 'api-key', key: value }))
    },
  })
}

// OAuth-family flows beyond the api-key: device authorization and the
// authorization-code grant with PKCE, both committing a grant record.
export { ConnectionFlowError, registerDeviceFlowConnection, registerOAuthConnection } from './flows.ts'
export type { DeviceFlowEndpoints, OAuthAppEndpoints } from './flows.ts'

// The tool plugin is the package's mountable entry: it registers the
// `request_credential` tool, which calls `registerApiKeyConnection` on demand.
export { apply, inject, name, questionFor, interactionFor } from './tool.ts'
