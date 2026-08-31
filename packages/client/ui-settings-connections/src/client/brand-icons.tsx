/**
 * Official brand logos for the shipped tool catalog, rendered as colored SVG
 * marks from the MIT-licensed @thesvg/react brand-icon library (the set
 * promptmack uses). Every mark is drawn inside the same fixed logo container,
 * so no mark can change the row layout; brands the library lacks fall back to
 * a colored monogram in that same container.
 * @module @deepseek-ai/dsh-client-ui-settings-connections/brand-icons
 */

import type { ComponentType, CSSProperties } from 'react'
import Airtable from '@thesvg/react/airtable'
import SendGrid from '@thesvg/react/azure-sendgrid-accounts'
import Aws from '@thesvg/react/aws'

import Clerk from '@thesvg/react/clerk'
import Cloudflare from '@thesvg/react/cloudflare'
import Discord from '@thesvg/react/discord'
import Firecrawl from '@thesvg/react/firecrawl'
import Github from '@thesvg/react/github'
import Hubspot from '@thesvg/react/hubspot'
import Linear from '@thesvg/react/linear'
import Mongodb from '@thesvg/react/mongodb'
import Neon from '@thesvg/react/neon'
import Notion from '@thesvg/react/notion'
import Posthog from '@thesvg/react/posthog'
import Postmark from '@thesvg/react/postmark'
import Qdrant from '@thesvg/react/qdrant'
import Replicate from '@thesvg/react/replicate'
import Resend from '@thesvg/react/resend'
import Sentry from '@thesvg/react/sentry'
import Slack from '@thesvg/react/slack'
import Stripe from '@thesvg/react/stripe'
import Supabase from '@thesvg/react/supabase'
import Tavily from '@thesvg/react/tavily'
import Twilio from '@thesvg/react/twilio'
import Upstash from '@thesvg/react/upstash'
import Vercel from '@thesvg/react/vercel'
import Webflow from '@thesvg/react/webflow'

type BrandIcon = ComponentType<{ className?: string | undefined; style?: CSSProperties | undefined }>

/** Service id -> official brand mark. Each component is a forward-ref svg,
 *  narrowed to the props the logo container passes. */
export const BRAND_ICONS: Record<string, BrandIcon> = {
  'airtable': Airtable as unknown as BrandIcon,
  'sendgrid': SendGrid as unknown as BrandIcon,
  'aws': Aws as unknown as BrandIcon,
  'clerk': Clerk as unknown as BrandIcon,
  'cloudflare': Cloudflare as unknown as BrandIcon,
  'discord': Discord as unknown as BrandIcon,
  'firecrawl': Firecrawl as unknown as BrandIcon,
  'github': Github as unknown as BrandIcon,
  'hubspot': Hubspot as unknown as BrandIcon,
  'linear': Linear as unknown as BrandIcon,
  'mongodb': Mongodb as unknown as BrandIcon,
  'neon': Neon as unknown as BrandIcon,
  'notion': Notion as unknown as BrandIcon,
  'posthog': Posthog as unknown as BrandIcon,
  'postmark': Postmark as unknown as BrandIcon,
  'qdrant': Qdrant as unknown as BrandIcon,
  'replicate': Replicate as unknown as BrandIcon,
  'resend': Resend as unknown as BrandIcon,
  'sentry': Sentry as unknown as BrandIcon,
  'slack': Slack as unknown as BrandIcon,
  'stripe': Stripe as unknown as BrandIcon,
  'supabase': Supabase as unknown as BrandIcon,
  'tavily': Tavily as unknown as BrandIcon,
  'twilio': Twilio as unknown as BrandIcon,
  'upstash': Upstash as unknown as BrandIcon,
  'vercel': Vercel as unknown as BrandIcon,
  'webflow': Webflow as unknown as BrandIcon,
}

/** The brand mark for a tool service id, when one ships. */
export function brandIconFor(id: string): BrandIcon | undefined {
  return BRAND_ICONS[id]
}

/**
 * Brand IDs whose SVG marks are white/light-coloured and invisible on
 * light/palomino themes — they must be CSS-inverted when the app is in a
 * light theme so the mark is visible.
 */
export const DARK_ONLY_BRANDS: ReadonlySet<string> = new Set([
  'resend',
  'vercel',
  'clerk',
  'replicate',
])

/**
 * Brand IDs whose SVG marks are black/dark-coloured and invisible on
 * the dark theme — they must be CSS-inverted in dark mode.
 */
export const LIGHT_ONLY_BRANDS: ReadonlySet<string> = new Set([
  'firecrawl',
  'qdrant',
])
