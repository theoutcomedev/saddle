/**
 * Workspace layouts, browser half. One promise: the screen fits the work, the
 * device, and the moment, and getting there costs neither state nor a reload.
 *
 * Three surfaces share one face: a headless applier in the root overlay that
 * arranges the shell from this device class's remembered layout, the Layout row
 * in the sidebar that lets a person choose, and the header chip that shows what
 * is in force and leaves it in one click. The agent's own switches reach the
 * shell through the `workspaceLayout` session projection, which the chip
 * consumes; everything else here is derived from the catalogue.
 *
 * The vocabulary is "layout", never "mode": the same header carries the
 * session's agent preset, which is what the assistant may do. Two concepts
 * called "mode" in one row is the confusion this naming exists to prevent.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceLayoutId } from '@deepseek-ai/dsh-workspace-modes/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ui-conversation SlotMap merge (the header action seat).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the ui-layout SlotMap merge (the root overlay seat) and the ILayout face.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the ui-sidebar SlotMap merge (the footer action row seat).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: pulls the `workspaceLayout` SessionProjectionMap merge for useProjection.
import type {} from '@deepseek-ai/dsh-workspace-modes/client'
import { LayoutApplier } from './LayoutApplier.tsx'
import { LayoutChip } from './LayoutChip.tsx'
import { LayoutsButton } from './LayoutsButton.tsx'
import { LAYOUT_ATTRIBUTE, applyLayout } from './apply.ts'
import { createLayoutsStore, deviceClassOf } from './store.ts'
import { en, zh, type LayoutsKey } from './locales.ts'
import './layouts-chrome.module.css'

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
    /** This device class's layout memory bound by the renderer as useLayouts. */
    layouts: ReturnType<ReturnType<typeof createLayoutsStore>['create']>['store']
  }
  /**
   * Arrange the shell for one layout and remember it for this device class.
   * @param layout - the layout to show.
   */
  apply: (layout: WorkspaceLayoutId) => void
}

/** Required services: the slot registry, the panel-action face, and the locale registry. */
export const inject = ['slots', 'layout', 'locale']

/**
 * Client plugin body: instantiate this device class's layout memory, then
 * register the applier, the chip, and the sidebar row over it.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-modes: dictionaries')

  // The framework does not own this store: a layout is not per session or per
  // pane, and its identity is the device class it was chosen on.
  const layouts = createLayoutsStore().create(deviceClassOf(window.innerWidth))
  const injected = (): LayoutsInjected => ({
    hooks: { layouts: layouts.store },
    apply: (layout: WorkspaceLayoutId) => {
      layouts.actions.setActive(layout)
      applyLayout(layout, ctx.layout, document.documentElement)
    },
  })

  ctx.effect(() => () => {
    document.documentElement.removeAttribute(LAYOUT_ATTRIBUTE)
  }, 'ui-modes: shell attribute')

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
