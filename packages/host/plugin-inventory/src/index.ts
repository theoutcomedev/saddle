/** Read-only projection of the current Cordis Loader plugin entries. */
import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { Context, FiberState } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type {
  PluginEntryId,
  PluginFiberPhase,
  PluginInventoryEntry,
  PluginInventorySnapshot,
} from './types.ts'

export type * from './types.ts'

/** Brand an existing Loader-tree entry id at the owning boundary. */
function pluginEntryId(value: string): PluginEntryId {
  return value as PluginEntryId
}

/** Runtime mirror: FiberState is a cross-package const enum. */
const FIBER_STATE = {
  PENDING: 0 as FiberState.PENDING,
  LOADING: 1 as FiberState.LOADING,
  ACTIVE: 2 as FiberState.ACTIVE,
  FAILED: 3 as FiberState.FAILED,
  DISPOSED: 4 as FiberState.DISPOSED,
  UNLOADING: 5 as FiberState.UNLOADING,
} as const

/** Complete public projection of Cordis Fiber states. */
const FIBER_PHASE = {
  [FIBER_STATE.PENDING]: 'pending',
  [FIBER_STATE.LOADING]: 'loading',
  [FIBER_STATE.ACTIVE]: 'active',
  [FIBER_STATE.FAILED]: 'failed',
  [FIBER_STATE.DISPOSED]: null,
  [FIBER_STATE.UNLOADING]: 'unloading',
} as const satisfies Record<FiberState, PluginFiberPhase>

/** Remote-only service exposing the Loader's current non-group entry state. */
export class PluginInventoryGateway extends TypertRemoteService {
  static inject = ['loader']

  constructor(ctx: Context) {
    super(ctx, 'pluginInventory')
  }

  /**
   * Read the Loader directly on every call. Cordis's internal plugin/status
   * events already maintain Entry.fiber and Fiber.state, so a second cache
   * would only add another lifecycle truth to keep synchronized.
   * @returns Current non-group Loader entries in Loader order.
   */
  @Remote('list')
  list(): PluginInventorySnapshot {
    const entries: PluginInventoryEntry[] = []
    for (const entry of this.ctx.loader.entries()) {
      if (entry.options.group) continue

      let description: string | undefined
      let icon: string | undefined
      let developer: string | undefined
      let tags: string[] | undefined
      let categories: string[] | undefined

      try {
        const url = import.meta.resolve(entry.options.name)
        let dir = dirname(fileURLToPath(url))
        while (dir !== '/' && !fs.existsSync(join(dir, 'package.json'))) {
          dir = dirname(dir)
        }
        if (fs.existsSync(join(dir, 'package.json'))) {
          const pkg = JSON.parse(fs.readFileSync(join(dir, 'package.json'), 'utf8'))
          description = pkg.description
          developer = pkg.author
          tags = pkg.keywords
          // Parse saddle-specific metadata if present
          if (pkg.saddle) {
            icon = pkg.saddle.icon
            categories = pkg.saddle.categories
          }
        }
      } catch (_e) {
        // Ignore resolution errors for virtual or dynamic modules
      }

      const entryObj: Partial<PluginInventoryEntry> = {
        entryId: pluginEntryId(entry.id),
        moduleName: entry.options.name,
        enabled: !entry.disabled,
        fiberPhase: entry.fiber === undefined ? null : FIBER_PHASE[entry.fiber.state],
      }
      if (description) entryObj.description = description
      if (icon) entryObj.icon = icon
      if (developer) entryObj.developer = developer
      if (tags) entryObj.tags = tags
      if (categories) entryObj.categories = categories

      entries.push(entryObj as PluginInventoryEntry)
    }
    return { entries }
  }

  /**
   * Toggle a plugin's enablement state in the Loader configuration.
   */
  @Remote('toggle')
  toggle(entryId: PluginEntryId, enabled: boolean): void {
    for (const entry of this.ctx.loader.entries()) {
      if (entry.id === entryId) {
        // The loader's update method persists the change to cordis.yml
        void entry.update({ disabled: !enabled })
        return
      }
    }
    throw new Error(`Plugin entry not found: ${entryId}`)
  }
}

export default PluginInventoryGateway
