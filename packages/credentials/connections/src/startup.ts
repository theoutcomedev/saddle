/**
 * The shipped connections catalog: the external TOOL services a deployment
 * offers on the Connections settings page out of the box. Every entry is an
 * api-key / paste-a-token service — those work immediately, with the exact
 * field(s) each provider wants named and a docs page to obtain them. OAuth and
 * device tools are NOT here: they need the deployment to register an app with
 * real endpoints, so a deployment adds them via registerOAuthConnection /
 * registerDeviceFlowConnection rather than through this catalog.
 * @module @deepseek-ai/dsh-connections/startup
 */

import type { Context } from '@deepseek-ai/cordis'
import { registerToolService, type ToolService } from './tool-service.ts'

/** The tools shipped with the deployment. */
export const CATALOG: readonly ToolService[] = [
  {
    id: 'twilio', label: 'Twilio',
    docsUrl: 'https://console.twilio.com/',
    auth: { method: 'api-key', fields: [
      { id: 'accountSid', label: 'Account SID' },
      { id: 'authToken', label: 'Auth Token' },
    ] },
  },
  { id: 'openphone', label: 'OpenPhone', docsUrl: 'https://app.openphone.co/developers', auth: { method: 'api-key' } },
  { id: 'zernio', label: 'Zernio', docsUrl: 'https://zernio.com/dashboard/api', auth: { method: 'api-key' } },
  { id: 'slack', label: 'Slack', docsUrl: 'https://api.slack.com/apps', auth: { method: 'api-key', fields: [
    { id: 'botToken', label: 'Bot User OAuth Token (xoxb-…)' },
  ] } },
  { id: 'notion', label: 'Notion', docsUrl: 'https://www.notion.so/my-integrations', auth: { method: 'api-key', fields: [
    { id: 'token', label: 'Integration token (secret_…)' },
  ] } },
  { id: 'stripe', label: 'Stripe', docsUrl: 'https://dashboard.stripe.com/apikeys', auth: { method: 'api-key', fields: [
    { id: 'secretKey', label: 'Secret key (sk_…)' },
  ] } },
  { id: 'sendgrid', label: 'SendGrid', docsUrl: 'https://app.sendgrid.com/settings/api_keys', auth: { method: 'api-key' } },
  { id: 'postmark', label: 'Postmark', docsUrl: 'https://account.postmarkapp.com/api_tokens', auth: { method: 'api-key', fields: [
    { id: 'serverToken', label: 'Server API token' },
  ] } },
  { id: 'airtable', label: 'Airtable', docsUrl: 'https://airtable.com/create/tokens', auth: { method: 'api-key', fields: [
    { id: 'personalToken', label: 'Personal access token (pat…)' },
  ] } },
  { id: 'hubspot', label: 'HubSpot', docsUrl: 'https://app.hubspot.com/private-apps', auth: { method: 'api-key' } },
  { id: 'linear', label: 'Linear', docsUrl: 'https://linear.app/settings/api', auth: { method: 'api-key' } },
  { id: 'discord', label: 'Discord', docsUrl: 'https://discord.com/developers/applications', auth: { method: 'api-key', fields: [
    { id: 'botToken', label: 'Bot token' },
  ] } },
  { id: 'calendly', label: 'Calendly', docsUrl: 'https://calendly.com/integrations/api', auth: { method: 'api-key', fields: [
    { id: 'personalToken', label: 'Personal access token' },
  ] } },
  { id: 'webflow', label: 'Webflow', docsUrl: 'https://developers.webflow.com/oauth', auth: { method: 'api-key' } },
  { id: 'pipedrive', label: 'Pipedrive', docsUrl: 'https://app.pipedrive.com/settings/integrations', auth: { method: 'api-key' } },
  { id: 'pushover', label: 'Pushover', docsUrl: 'https://pushover.net/api', auth: { method: 'api-key' } },
  { id: 'resend', label: 'Resend', docsUrl: 'https://resend.com/api-keys', auth: { method: 'api-key' } },
  { id: 'github', label: 'GitHub', docsUrl: 'https://github.com/settings/tokens', auth: { method: 'api-key', fields: [
    { id: 'pat', label: 'Personal access token (ghp_…)' },
  ] } },
  { id: 'supabase', label: 'Supabase', docsUrl: 'https://supabase.com/dashboard/account/tokens', auth: { method: 'api-key', fields: [
    { id: 'serviceRole', label: 'Service role key (sb_…)' },
  ] } },
]

/** Cordis plugin name. */
export const name = 'connections-catalog'
/** Services the catalog registers flows through. */
export const inject = ['authorization', 'credentials']

/**
 * Register the shipped tool flows.
 * @param ctx - the plugin context carrying ctx.authorization and ctx.credentials.
 */
export function apply(ctx: Context): () => void {
  return ctx.effect(() => {
    const disposers = CATALOG.map(service => registerToolService(ctx, service))
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'connections-catalog: tool flows')
}
