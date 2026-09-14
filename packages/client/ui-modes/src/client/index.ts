/**
 * Workspace layouts, browser half. One promise: the screen fits the work, the
 * device, and the moment, and getting there costs neither state nor a reload.
 *
 * Three surfaces share one face: the Layout row in the sidebar, the picker it
 * opens (scoped to the jobs this device actually has), and the header chip that
 * shows what is in force and leaves it in one click. A headless applier in the
 * root overlay applies this device class's remembered layout on load, and the
 * agent's own switches arrive through the `workspaceLayout` session projection.
 *
 * The device class comes from the shell's device model (`ctx.device`), never
 * from a ladder of this package's own: that is how the shell ended up with five
 * disagreeing thresholds.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceLayoutId } from '@deepseek-ai/dsh-workspace-modes/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ui-conversation SlotMap merge (the header action seat).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the ui-layout Context merge (ctx.device) and the service faces.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the ui-sidebar SlotMap merge (the footer action row seat).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: pulls the `workspaceLayout` SessionProjectionMap merge for useProjection.
import type {} from '@deepseek-ai/dsh-workspace-modes/client'
import { LayoutApplier } from './LayoutApplier.tsx'
import { LayoutChip } from './LayoutChip.tsx'
import { LayoutsButton } from './LayoutsButton.tsx'
import { LAYOUT_ATTRIBUTE, applyLayout } from './apply.ts'
import { createLayoutsStore } from './store.ts'
import { en, zh, type LayoutsKey } from './locales.ts'

export type { LayoutsKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The workspace-layout copy: the row, the picker, and every layout's own line. */
    layouts: LayoutsKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'layouts'

/** Injected business face shared by every layout surface. */
export interface LayoutsInjected {
  hooks: {
    /** The layout memory bound by the renderer as useLayouts. */
    layouts: ReturnType<ReturnType<typeof createLayoutsStore>['create']>['store']
  }
  /**
   * Arrange the shell for one layout and remember it for the current device class.
   * @param layout - the layout to show.
   */
  apply: (layout: WorkspaceLayoutId) => void
}

/** Required services: the slot registry, the panel-action face, the device model, and the locale registry. */
export const inject = ['slots', 'layout', 'device', 'locale']

/**
 * Client plugin body: instantiate the layout memory and follow the device class,
 * then register the applier, the chip, and the sidebar row over it.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-modes: dictionaries')

  const layouts = createLayoutsStore().create()
  // The device class is followed rather than captured: one shell serves a phone
  // and a laptop, so which remembered layout is in force changes with the same
  // facts that change the shell's placements.
  ctx.effect(() => {
    layouts.actions.setDeviceClass(ctx.device.facts().class)
    return ctx.device.watch((facts) => { layouts.actions.setDeviceClass(facts.class) })
  }, 'ui-modes: device class')

  const injected = (): LayoutsInjected => ({
    hooks: { layouts: layouts.store },
    apply: (layout: WorkspaceLayoutId) => {
      layouts.actions.setActive(layout)
      applyLayout(layout, ctx.layout, document.documentElement)
    },
  })

  ctx.effect(() => () => {
    document.documentElement.removeAttribute(LAYOUT_ATTRIBUTE)
  }, 'ui-modes: layout attribute')

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'workspace-layout',
    inject: injected,
  }, LayoutApplier))

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'workspace-layout',
    order: 10,
    locale: NS,
    inject: injected,
  }, LayoutsButton))

  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: 'workspace-layout',
    locale: NS,
    inject: injected,
  }, LayoutChip))
}
