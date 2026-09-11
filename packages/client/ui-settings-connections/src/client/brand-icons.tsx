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

import Cloudflare from '@thesvg/react/cloudflare'
import Discord from '@thesvg/react/discord'
import Github from '@thesvg/react/github'
import Hubspot from '@thesvg/react/hubspot'
import Linear from '@thesvg/react/linear'
import Mongodb from '@thesvg/react/mongodb'
import Neon from '@thesvg/react/neon'
import Posthog from '@thesvg/react/posthog'
import Postmark from '@thesvg/react/postmark'
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

function SteelIcon({ className, style }: { className?: string | undefined; style?: CSSProperties | undefined }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 556 400" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      <path d="M131.683 0C58.9566 0 0 57.5629 0 128.57C0 199.578 58.9566 257.141 131.683 257.141H277.998C286.079 257.141 292.629 263.537 292.629 271.426C292.629 279.316 286.079 285.712 277.998 285.712H10.242C4.58553 285.712 0 290.189 0 295.712V389.997C0 395.52 4.58553 399.997 10.242 399.997H277.998C350.725 399.997 409.681 342.434 409.681 271.426C409.681 200.419 350.725 142.856 277.998 142.856H131.683C123.603 142.856 117.052 136.46 117.052 128.57C117.052 120.681 123.603 114.285 131.683 114.285H379.797C380.005 114.287 380.213 114.288 380.422 114.288H424.317C432.397 114.288 438.948 120.684 438.948 128.574V390C438.948 395.523 443.534 400 449.19 400H545.758C551.415 400 556 395.523 556 390V128.574C556 57.5661 497.043 0.00320407 424.317 0.00320407H409.681V0H131.683Z" fill="#F5D90A"/>
    </svg>
  )
}

/** Service id -> official brand mark. Each component is a forward-ref svg,
 *  narrowed to the props the logo container passes. */
export const BRAND_ICONS: Record<string, BrandIcon> = {
  'airtable': Airtable as unknown as BrandIcon,
  'sendgrid': SendGrid as unknown as BrandIcon,
  'aws': Aws as unknown as BrandIcon,
  'cloudflare': Cloudflare as unknown as BrandIcon,
  'discord': Discord as unknown as BrandIcon,
  'github': Github as unknown as BrandIcon,
  'hubspot': Hubspot as unknown as BrandIcon,
  'linear': Linear as unknown as BrandIcon,
  'mongodb': Mongodb as unknown as BrandIcon,
  'neon': Neon as unknown as BrandIcon,
  'posthog': Posthog as unknown as BrandIcon,
  'postmark': Postmark as unknown as BrandIcon,
  'replicate': Replicate as unknown as BrandIcon,
  'resend': Resend as unknown as BrandIcon,
  'sentry': Sentry as unknown as BrandIcon,
  'slack': Slack as unknown as BrandIcon,
  'steel-browser': SteelIcon,
  'steel': SteelIcon,
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
  'replicate',
])

/**
 * Brand IDs whose SVG marks are black/dark-coloured and invisible on
 * the dark theme — they must be CSS-inverted in dark mode.
 */
export const LIGHT_ONLY_BRANDS: ReadonlySet<string> = new Set([
  'github',
  'sentry',
])
