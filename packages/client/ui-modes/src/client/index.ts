/**
 * Workspace modes, browser half. One promise: the screen fits the work, the
 * device, and the moment, and getting there costs neither state nor a reload.
 *
 * Three surfaces share one face: a headless applier in the root overlay that
 * arranges the shell from this device class's remembered mode, the Modes row
 * in the sidebar that lets a person choose, and the header chip that shows
 * what is in force and leaves it in one click. The agent's own switches reach
 * the shell through the `workspaceMode` session projection, which the chip
 * consumes; everything else here is derived from the catalogue.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceModeId } from '@deepseek-ai/dsh-workspace-modes/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ui-conversation SlotMap merge (the header action seat).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the ui-layout SlotMap merge (the root overlay seat) and the ILayout face.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the ui-sidebar SlotMap merge (the footer action row seat).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: pulls the `workspaceMode` SessionProjectionMap merge for useProjection.
import type {} from '@deepseek-ai/dsh-workspace-modes/client'
import { ModeApplier } from './ModeApplier.tsx'
import { ModeChip } from './ModeChip.tsx'
import { ModesButton } from './ModesButton.tsx'
import { MODE_ATTRIBUTE, applyMode } from './apply.ts'
import { createModesStore, deviceClassOf } from './store.ts'
import { en, zh, type ModesKey } from './locales.ts'
import './modes-chrome.module.css'

export type { ModesKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The workspace-modes copy: the row, the picker, and every mode's own line. */
    modes: ModesKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'modes'

/** Injected business face shared by every modes surface. */
export interface ModesInjected {
  hooks: {
    /** This device class's mode memory bound by the renderer as useModes. */
    modes: ReturnType<ReturnType<typeof createModesStore>['create']>['store']
  }
  /**
   * Arrange the shell for one mode and remember it for this device class.
   * @param mode - the mode to show.
   */
  apply: (mode: WorkspaceModeId) => void
}

/** Required services: the slot registry, the panel-action face, and the locale registry. */
export const inject = ['slots', 'layout', 'locale']

/**
 * Client plugin body: instantiate this device class's mode memory, then
 * register the applier, the chip, and the sidebar row over it.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-modes: dictionaries')

  // The framework does not own this store: a mode is not per session or per
  // pane, and its identity is the device class it was chosen on.
  const modes = createModesStore().create(deviceClassOf(window.innerWidth))
  const injected = (): ModesInjected => ({
    hooks: { modes: modes.store },
    apply: (mode: WorkspaceModeId) => {
      modes.actions.setActive(mode)
      applyMode(mode, ctx.layout, document.documentElement)
    },
  })

  ctx.effect(() => () => {
    document.documentElement.removeAttribute(MODE_ATTRIBUTE)
  }, 'ui-modes: shell attribute')

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'workspace-mode',
    inject: injected,
  }, ModeApplier))

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'workspace-modes',
    order: 10,
    locale: NS,
    inject: injected,
  }, ModesButton))

  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: 'workspace-mode',
    locale: NS,
    inject: injected,
  }, ModeChip))
}
