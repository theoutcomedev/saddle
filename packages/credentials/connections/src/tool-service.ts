/**
 * Tool connection registration: a service the user connects to give the agent
 * access to an external tool. Beyond the generic single-secret api-key flow,
 * a tool service names the exact field(s) it wants (Twilio's Account SID and
 * Auth Token, a Slack bot token) and a docs page to get them, so the surface
 * can ask for precisely the right thing and link the provider's portal.
 *
 * The shipped catalog is api-key/paste-a-token: those work out of the box.
 * OAuth and device services are the same helper shapes but need the deployment
 * to register an app with real endpoints, so they are not in the shipped
 * catalog — a deployment adds them by calling registerOAuthConnection /
 * registerDeviceFlowConnection with its own client id and redirect.
 * @module @deepseek-ai/dsh-connections/tool-service
 */

import type { Context } from '@deepseek-ai/cordis'
import type { AuthorizationMethod } from '@deepseek-ai/dsh-authorization'
import { connectionKey } from './index.ts'

/** One named field an api-key tool asks for. */
export interface ToolAuthField {
  /** Stable id, stored keyed in the committed record. */
  id: string
  /** User-facing label (e.g. Account SID, Auth Token, Bot token). */
  label: string
  /** Mask this as a secret; defaults to true. */
  secret?: boolean
}

/** One connectable external tool service. */
export interface ToolService {
  /** Stable lowercase-hyphenated id (the credential record segment). */
  id: string
  /** User-facing service name. */
  label: string
  /** Provider page to get the credential. */
  docsUrl: string
  /** How the service authenticates. */
  auth: {
    method: 'api-key' | 'oauth' | 'device'
    /** Named api-key fields; defaults to a single "API key" secret field. */
    fields?: readonly ToolAuthField[]
  }
}

/**
 * Register one tool service as an authorization flow. For api-key tools the
 * flow prompts once per named field and commits a single grant record with the
 * values keyed by field id.
 * @param ctx - the plugin context carrying ctx.authorization and ctx.credentials.
 * @param service - the tool to connect.
 * @returns a disposer that withdraws the flow.
 */
export function registerToolService(ctx: Context, service: ToolService): () => void {
  const key = connectionKey({ id: service.id, label: service.label })
  const fields: readonly ToolAuthField[] = service.auth.fields ?? [{ id: 'key', label: 'API key' }]
  const methods: readonly [AuthorizationMethod, ...AuthorizationMethod[]] =
    service.auth.method === 'oauth'
      ? [{ id: 'oauth', label: 'Browser sign-in' }]
      : service.auth.method === 'device'
        ? [{ id: 'device', label: 'Device code' }]
        : [{ id: 'api-key', label: 'API key' }]
  return ctx.authorization.registerFlow({
    key,
    label: service.label,
    methods,
    docsUrl: service.docsUrl,
    // Single-secret flows keep the seam's default field-less shape; multi-field
    // tools carry their named fields so a surface can label each prompt.
    ...fields.length === 1 ? {} : { fields },
    async run(session) {
      if (service.auth.method !== 'api-key') {
        throw new Error(
          `${service.label} uses ${service.auth.method} auth — this deployment has not configured its endpoints, so it cannot be connected from this page`,
        )
      }
      const values: Record<string, string> = {}
      for (const field of fields) {
        const fieldLabel = field.id === 'key' ? 'API key' : field.label
        values[field.id] = await session.prompt({
          kind: field.secret === false ? 'text' : 'secret',
          message: `Enter the ${service.label} ${fieldLabel}`,
        })
      }
      await ctx.credentials.modifyRecord(key, () => Promise.resolve({
        kind: 'grant',
        payload: { type: 'api-key', service: service.id, values },
      }))
    },
  })
}
