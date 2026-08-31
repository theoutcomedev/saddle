/**
 * Official brand logos for the shipped tool catalog, rendered as colored SVG
 * marks from the MIT-licensed @thesvg/react brand-icon library (the same set
 * promptmack uses). Brands that library does not ship (Pipedrive, Pushover,
 * OpenPhone, Zernio) fall back to a colored monogram.
 * @module @deepseek-ai/dsh-client-ui-settings-connections/brand-icons
 */

import type { ComponentType, CSSProperties } from 'react'
import Airtable from '@thesvg/react/airtable'
import SendGrid from '@thesvg/react/azure-sendgrid-accounts'
import Calendly from '@thesvg/react/calendly'
import Discord from '@thesvg/react/discord'
import Github from '@thesvg/react/github'
import Hubspot from '@thesvg/react/hubspot'
import Linear from '@thesvg/react/linear'
import Notion from '@thesvg/react/notion'
import Postmark from '@thesvg/react/postmark'
import Resend from '@thesvg/react/resend'
import Slack from '@thesvg/react/slack'
import Stripe from '@thesvg/react/stripe'
import Supabase from '@thesvg/react/supabase'
import Twilio from '@thesvg/react/twilio'
import Webflow from '@thesvg/react/webflow'

type BrandIcon = ComponentType<{ className?: string | undefined; style?: CSSProperties | undefined }>

/** Service id -> official brand mark. Each component is a forward-ref svg,
 *  narrowed to the props the badge passes. */
export const BRAND_ICONS: Record<string, BrandIcon> = {
  airtable: Airtable as unknown as BrandIcon,
  calendly: Calendly as unknown as BrandIcon,
  discord: Discord as unknown as BrandIcon,
  github: Github as unknown as BrandIcon,
  hubspot: Hubspot as unknown as BrandIcon,
  linear: Linear as unknown as BrandIcon,
  notion: Notion as unknown as BrandIcon,
  postmark: Postmark as unknown as BrandIcon,
  resend: Resend as unknown as BrandIcon,
  sendgrid: SendGrid as unknown as BrandIcon,
  slack: Slack as unknown as BrandIcon,
  stripe: Stripe as unknown as BrandIcon,
  supabase: Supabase as unknown as BrandIcon,
  twilio: Twilio as unknown as BrandIcon,
  webflow: Webflow as unknown as BrandIcon,
}

/** The brand mark for a tool service id, when one ships. */
export function brandIconFor(id: string): BrandIcon | undefined {
  return BRAND_ICONS[id]
}
