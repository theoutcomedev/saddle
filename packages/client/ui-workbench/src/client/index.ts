/**
 * Workbench plugin, browser half: take over the details column as a tabbed
 * dock. One register() call contributes the Workbench into the already-declared
 * details slot and declares the pane slots it can render; the re-homed
 * session Details panel (ui-conversation) and the job pane register into those
 * pane slots. Open-tab state is component-local, so the workbench owns no store.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { Workbench } from './Workbench.tsx'
import { JobsPane } from './jobs-pane.tsx'
import { BrowserPane } from './browser-pane.tsx'
import { FilesPane } from './files-pane.tsx'
import { WorkbenchHeaderToggle } from './WorkbenchHeaderToggle.tsx'
import { en, NS, zh } from './locales.ts'
import type {} from './contract/slots.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Workbench tab-strip copy. */
    'workbench': import('./locales.ts').WorkbenchKey
  }
}

/** Required services: the slot registry, the locale catalog, and ctx.layout. */
export const inject = ['slots', 'locale', 'layout', 'workspaces']

/**
 * Client plugin body: register the dictionary, the details occupant (the
 * Workbench), and the job pane.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-workbench: dictionaries')

  ctx.effect(() => ctx.slots.register({
    name: 'details',
    locale: NS,
    children: {
      'workbench.pane.details': { kind: 'single', scope: 'session' },
      'workbench.pane.jobs': { kind: 'single', scope: 'session' },
      'workbench.pane.browser': { kind: 'single', scope: 'session' },
      'workbench.pane.files': { kind: 'single', scope: 'session' },
    },
    inject: (): { closeDetails: () => void; openDetails: () => void } => ({
      closeDetails: () => { ctx.layout.closeDetails() },
      openDetails: () => { ctx.layout.openDetails() },
    }),
  }, Workbench), 'ui-workbench: details occupant')

  // The job pane contributes into the declared pane slot; it waits on the
  // declaration from the details registration above.
  ctx.slots.inject('workbench.pane.jobs',
    () => ctx.slots.register({ name: 'workbench.pane.jobs', locale: NS }, JobsPane))

  // The browser/preview pane contributes into its declared pane slot.
  ctx.slots.inject('workbench.pane.browser',
    () => ctx.slots.register({ name: 'workbench.pane.browser', locale: NS }, BrowserPane))

  // The files pane (explorer + viewer) is backed by the workspaces host service.
  ctx.slots.inject('workbench.pane.files',
    () => ctx.slots.register({
      name: 'workbench.pane.files',
      locale: NS,
      inject: () => ({
        listFiles: (path: string, signal?: AbortSignal) => ctx.workspaces.listFiles(path, signal),
        readFile: (path: string, signal?: AbortSignal) => ctx.workspaces.readFile(path, signal),
        openPath: (path: string) => ctx.workspaces.openPath(path),
      }),
    }, FilesPane))

  // Workbench toggle button in the session header utilities (top-right of the app, like Antigravity)
  ctx.slots.inject('conversation.session.header.utilities',
    () => ctx.slots.register({
      name: 'conversation.session.header.utilities',
      id: 'workbench-toggle',
      locale: NS,
      inject: () => ({
        toggle: () => { ctx.layout.toggleDetails() },
      }),
    }, WorkbenchHeaderToggle))
}
