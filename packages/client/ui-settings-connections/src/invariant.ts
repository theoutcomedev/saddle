/**
 * Package-owned invariant companion for @deepseek-ai/dsh-client-ui-settings-connections.
 * @module @deepseek-ai/dsh-client-ui-settings-connections/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-settings-connections'

/** Cordis companion plugin name. */
export const name = 'client-ui-settings-connections-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: a nav-entry-only section plugin rendering the
 * connections wire domain — it emits no cordis events and owns no
 * cross-plugin mutable relation; the host authorization seam's own companion
 * owns the credential lifecycle contract.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
