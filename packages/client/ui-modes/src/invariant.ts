/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-modes`.
 * @module @deepseek-ai/dsh-client-ui-modes/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-modes'

/** Cordis companion plugin name. */
export const name = 'client-ui-modes-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the durable half of a mode switch is audited by
 * `@deepseek-ai/dsh-workspace-modes`, which owns the `workspace/mode` event
 * and its projection; this package owns the arrangement, the chip, and the
 * per-device-class preference, each covered by its own specs.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns The installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
