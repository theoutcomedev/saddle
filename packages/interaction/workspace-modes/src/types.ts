/**
 * Pure types of the workspace-layout domain: the ONE home of the
 * `workspaceLayout` projection-key declaration, free of this package's
 * host-side value imports (dsh-tools, zod). Two namespace projections serve it
 * — `./types` for host consumers, `./client` for client aggregates — with zero
 * content duplication.
 *
 * @module @deepseek-ai/dsh-workspace-modes/types
 */

/**
 * The arrangements this build offers. A layout names a shape, never a size: the
 * browser half owns what each id arranges, and the two sides are held together
 * by the catalogue below plus a spec that reads both.
 *
 * The vocabulary is deliberately not "mode". An agent preset is a mode of the
 * assistant — what it may do — and this is the shape of the screen it does it
 * on; naming both "mode" makes them indistinguishable in a header that shows
 * one of each.
 */
export type WorkspaceLayoutId =
  | 'default'
  | 'capture'
  | 'read'
  | 'focus'
  | 'zen'
  | 'workbench'
  | 'counter'
  | 'studio'
  | 'wall'

/** One session's recorded layout, and the event that recorded it. */
export interface WorkspaceLayoutState {
  /** The last layout this session asked its screen to show. */
  layout: WorkspaceLayoutId
  /**
   * Sequence number of the `workspace/layout` event that recorded it. Two
   * requests for the same layout are two instructions, and only the sequence
   * tells them apart; a renderer that applied by value alone would ignore the
   * second one.
   */
  at: number
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    workspaceLayout: WorkspaceLayoutState | null
  }
  interface SessionProjectionMap {
    /**
     * The shape this session last asked the shell to take, or `null` before
     * the first request. Last event wins; `at` is that event's own sequence.
     */
    workspaceLayout: WorkspaceLayoutState | null
  }
}
