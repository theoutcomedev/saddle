/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-workspace-modes`.
 *
 * The relationship this package owns is between one tool call and one log
 * event: `set_workspace_mode` appends exactly one `workspace/mode` carrying the
 * mode it reported. That relation is asserted where the tool runs (the
 * package's composition spec drives the real Loader and reads the session log
 * afterwards), so the runtime installer has nothing of its own to add.
 *
 * @module @deepseek-ai/dsh-workspace-modes/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-workspace-modes'

/** Cordis companion plugin name. */
export const name = 'workspace-modes-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the tool-to-event relation is a single-call, single-
 * append fact with no standing state to audit, and its composition spec
 * exercises the real Loader and the session log.
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
