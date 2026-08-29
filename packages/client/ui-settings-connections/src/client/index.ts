/**
 * Connections settings section plugin, browser half. It registers the
 * Connections page (a curated service catalog with docs links). Connection is
 * performed in chat through the `request_credential` tool; this page does not
 * own the capture surface.
 * @module @deepseek-ai/dsh-client-ui-settings-connections/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the shell's SlotMap merge (the 'settings.section' entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { ConnectionsSection } from './ConnectionsSection.tsx'
import type { ConnectionsSectionInjected } from './ConnectionsSection.tsx'
import { en, zh, type ConnectionsKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Connections page copy. */
    'settings.connections': ConnectionsKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.connections'

/** Required services for the section registration. */
export const inject = ['slots', 'locale']

/**
 * Register the Connections section once the `settings.section` declaration is
 * on the ledger.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-connections: copy dictionaries')
  const t = ctx.locale.bind(NS) as ConnectionsSectionInjected['t']
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'connections',
    order: 20,
    label: () => t('nav'),
    inject: () => ({ t }),
  }, ConnectionsSection))
}
