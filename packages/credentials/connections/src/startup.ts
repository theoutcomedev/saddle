/**
 * The shipped connections catalog: the services a deployment offers on the
 * Connections settings page out of the box, each connecting through the
 * generic api-key flow. A deployment replaces this roster by mounting its own
 * catalog (or overlaying this row's id) with the services it actually offers;
 * the model-facing request_credential tool remains available for anything
 * else, registering a flow on demand.
 * @module @deepseek-ai/dsh-connections/startup
 */

import type { Context } from '@deepseek-ai/cordis'
import { registerApiKeyConnection, type ApiKeyConnection } from './index.ts'

/** The services shipped with the deployment. */
export const CATALOG: readonly ApiKeyConnection[] = [
  { id: 'supabase', label: 'Supabase', docsUrl: 'https://supabase.com/dashboard/account/tokens' },
  { id: 'github', label: 'GitHub', docsUrl: 'https://github.com/settings/tokens' },
  { id: 'openai', label: 'OpenAI', docsUrl: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', label: 'Anthropic', docsUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'resend', label: 'Resend', docsUrl: 'https://resend.com/api-keys' },
]

/** Cordis plugin name. */
export const name = 'connections-catalog'
/** Services the catalog registers flows through. */
export const inject = ['authorization', 'credentials']

/**
 * Register the shipped api-key flows.
 * @param ctx - the plugin context carrying ctx.authorization and ctx.credentials.
 */
export function apply(ctx: Context): () => void {
  return ctx.effect(() => {
    const disposers = CATALOG.map(connection => registerApiKeyConnection(ctx, connection))
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'connections-catalog: api-key flows')
}
