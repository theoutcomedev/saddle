/**
 * Connections settings plugin, browser half. It registers the Connections page
 * (settings.section) over the connections wire domain; the host owns every
 * authorization attempt and every credential record. Export discipline:
 * packages/client/AGENTS.md.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the shell's SlotMap merge (the 'settings.section' entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the runtime's ctx.connections merge into this program.
import type {} from '@deepseek-ai/dsh-client-runtime/client'
import { ConnectionsSection } from './ConnectionsSection.tsx'
import type { ConnectionsSectionInjected } from './ConnectionsSection.tsx'
import { en, zh, type ConnectionsKey } from './locales.ts'

export type { ConnectionsSectionInjected, ConnectionsSectionProps } from './ConnectionsSection.tsx'
export type { ConnectionsKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Connections settings section copy. */
    'settings.connections': ConnectionsKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.connections'

/**
 * Required services (cordis fiber inject). The target slot is declared by
 * ui-settings' apply, whose activation order relative to this one is NOT
 * constrained; registration depends on it through slots.inject().
 */
export const inject = ['slots', 'locale', 'connection', 'remote', 'connections']

/**
 * Register the Connections section once the settings.section declaration is
 * on the ledger, and register its copy dictionaries.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-connections: copy dictionaries')
  const t = ctx.locale.bind(NS) as ConnectionsSectionInjected['t']
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'connections',
    order: 18,
    label: () => t('nav'),
    inject: () => ({
      connections: ctx.connections,
      t,
    }),
  }, ConnectionsSection))
}
