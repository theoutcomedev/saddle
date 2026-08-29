/**
 * "My Apps" sidebar surface: registers the "Apps" action beside Settings at
 * the sidebar foot.
 * @module @deepseek-ai/dsh-client-ui-app-store
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { AppsEntry } from './AppStore.tsx'

/** Services required by the sidebar registration and the appStore Remote. */
export const inject = ['slots', 'remote', 'remote.appStore']

/** Register the "Apps" action beside Settings at the sidebar foot. */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'my-apps',
    order: 10,
    inject: () => ({ appStore: ctx.remote.appStore }),
  }, AppsEntry))
}
