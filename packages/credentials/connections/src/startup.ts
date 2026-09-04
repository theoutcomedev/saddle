/**
 * The shipped connections catalog: external TOOL and infra services a
 * deployment offers on the Connections settings page out of the box. Each
 * entry is an api-key / paste-a-token service — those work immediately, with
 * the exact field(s) each provider wants named, a general docs page
 * (docsUrl), and the exact page to obtain the credential (getKeyUrl — a
 * different thing). OAuth and device tools are NOT here: they need the
 * deployment to register an app with real endpoints. AI-model providers are
 * deliberately absent (the Models page owns those).
 * @module @deepseek-ai/dsh-connections/startup
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { registerToolService, type ToolService } from './tool-service.ts'
import { CustomConnectionsService } from './custom-connections.ts'

/** The tools shipped with the deployment. */
export const CATALOG: readonly ToolService[] = [
  // ── communications ──────────────────────────────────────────────────────
  { id: 'twilio', label: 'Twilio', docsUrl: 'https://www.twilio.com/docs', getKeyUrl: 'https://console.twilio.com/', auth: { method: 'api-key', fields: [
    { id: 'accountSid', label: 'Account SID' }, { id: 'authToken', label: 'Auth Token' },
  ] } },
  { id: 'slack', label: 'Slack', docsUrl: 'https://api.slack.com', getKeyUrl: 'https://api.slack.com/apps', auth: { method: 'api-key', fields: [
    { id: 'botToken', label: 'Bot User OAuth Token (xoxb-…)' },
  ] } },
  { id: 'discord', label: 'Discord', docsUrl: 'https://discord.com/developers/docs', getKeyUrl: 'https://discord.com/developers/applications', auth: { method: 'api-key', fields: [
    { id: 'botToken', label: 'Bot token' },
  ] } },
  { id: 'sendgrid', label: 'SendGrid', docsUrl: 'https://docs.sendgrid.com', getKeyUrl: 'https://app.sendgrid.com/settings/api_keys', auth: { method: 'api-key' } },
  { id: 'postmark', label: 'Postmark', docsUrl: 'https://postmarkapp.com/developer', getKeyUrl: 'https://account.postmarkapp.com/api_tokens', auth: { method: 'api-key', fields: [
    { id: 'serverToken', label: 'Server API token' },
  ] } },
  { id: 'resend', label: 'Resend', docsUrl: 'https://resend.com/docs', getKeyUrl: 'https://resend.com/api-keys', auth: { method: 'api-key' } },

  // ── productivity / data ─────────────────────────────────────────────────
  { id: 'airtable', label: 'Airtable', docsUrl: 'https://airtable.com/developers', getKeyUrl: 'https://airtable.com/create/tokens', auth: { method: 'api-key', fields: [
    { id: 'personalToken', label: 'Personal access token (pat…)' },
  ] } },
  { id: 'hubspot', label: 'HubSpot', docsUrl: 'https://developers.hubspot.com', getKeyUrl: 'https://app.hubspot.com/private-apps', auth: { method: 'api-key' } },
  { id: 'linear', label: 'Linear', docsUrl: 'https://developers.linear.app', getKeyUrl: 'https://linear.app/settings/api', auth: { method: 'api-key' } },
  { id: 'webflow', label: 'Webflow', docsUrl: 'https://developers.webflow.com', getKeyUrl: 'https://developers.webflow.com/oauth', auth: { method: 'api-key' } },

  // ── payments / dev / infra ──────────────────────────────────────────────
  { id: 'stripe', label: 'Stripe', docsUrl: 'https://docs.stripe.com', getKeyUrl: 'https://dashboard.stripe.com/apikeys', auth: { method: 'api-key', fields: [
    { id: 'secretKey', label: 'Secret key (sk_…)' },
  ] } },
  { id: 'github', label: 'GitHub', docsUrl: 'https://docs.github.com', getKeyUrl: 'https://github.com/settings/tokens', auth: { method: 'api-key', fields: [
    { id: 'pat', label: 'Personal access token (ghp_…)' },
  ] } },
  { id: 'supabase', label: 'Supabase', docsUrl: 'https://supabase.com/docs', getKeyUrl: 'https://supabase.com/dashboard/account/tokens', auth: { method: 'api-key', fields: [
    { id: 'serviceRole', label: 'Service role key (sb_…)' },
  ] } },
  { id: 'vercel', label: 'Vercel', docsUrl: 'https://vercel.com/docs', getKeyUrl: 'https://vercel.com/account/tokens', auth: { method: 'api-key', fields: [
    { id: 'token', label: 'API token' },
  ] } },
  { id: 'aws', label: 'AWS', docsUrl: 'https://docs.aws.amazon.com', getKeyUrl: 'https://console.aws.amazon.com/iam/home#/security_credentials', auth: { method: 'api-key', fields: [
    { id: 'accessKeyId', label: 'Access Key ID' }, { id: 'secretAccessKey', label: 'Secret Access Key' },
  ] } },
  { id: 'cloudflare', label: 'Cloudflare', docsUrl: 'https://developers.cloudflare.com', getKeyUrl: 'https://dash.cloudflare.com/profile/api-tokens', auth: { method: 'api-key', fields: [
    { id: 'apiToken', label: 'API token' },
  ] } },
  { id: 'tavily', label: 'Tavily', docsUrl: 'https://docs.tavily.com', getKeyUrl: 'https://app.tavily.com', auth: { method: 'api-key', fields: [
    { id: 'apiKey', label: 'API key' },
  ] } },
  { id: 'sentry', label: 'Sentry', docsUrl: 'https://docs.sentry.io', getKeyUrl: 'https://sentry.io/settings/auth-tokens', auth: { method: 'api-key', fields: [
    { id: 'authToken', label: 'Auth token' },
  ] } },
  { id: 'posthog', label: 'PostHog', docsUrl: 'https://posthog.com/docs', getKeyUrl: 'https://app.posthog.com/settings/project', auth: { method: 'api-key', fields: [
    { id: 'apiKey', label: 'Project API key' },
  ] } },
  { id: 'mongodb', label: 'MongoDB', docsUrl: 'https://www.mongodb.com/docs', getKeyUrl: 'https://www.mongodb.com/cloud/atlas', auth: { method: 'api-key', fields: [
    { id: 'uri', label: 'Connection string (mongodb+srv://…)' },
  ] } },
  { id: 'neon', label: 'Neon', docsUrl: 'https://neon.tech/docs', getKeyUrl: 'https://neon.tech/docs/connect', auth: { method: 'api-key', fields: [
    { id: 'databaseUrl', label: 'Connection string' },
  ] } },
  { id: 'upstash', label: 'Upstash', docsUrl: 'https://upstash.com/docs', getKeyUrl: 'https://console.upstash.com', auth: { method: 'api-key', fields: [
    { id: 'restUrl', label: 'REST URL' }, { id: 'restToken', label: 'REST token' },
  ] } },
  { id: 'replicate', label: 'Replicate', docsUrl: 'https://replicate.com/docs', getKeyUrl: 'https://replicate.com/account/api-tokens', auth: { method: 'api-key', fields: [
    { id: 'apiToken', label: 'API token' },
  ] } },
]

/** Cordis plugin name. */
export const name = 'connections-catalog'
/** Services the catalog registers flows through. */
export const inject = ['authorization', 'credentials']

/**
 * Mount the custom-connections service (persisted user-added tools), restore
 * stored ones, and register the shipped tool flows.
 * @param ctx - the plugin context carrying ctx.authorization and ctx.credentials.
 */
export async function apply(ctx: Context): Promise<() => void> {
  const file = process.env.DSH_HOME
    ? join(process.env.DSH_HOME, 'connections.json')
    : join(homedir(), '.dsh', 'connections.json')
  const custom = new CustomConnectionsService(ctx, { file })
  await custom.load()
  return ctx.effect(() => {
    const disposers = CATALOG.map(service => registerToolService(ctx, service))
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'connections-catalog: tool flows')
}
