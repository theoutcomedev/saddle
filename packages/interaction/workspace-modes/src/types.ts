/**
 * Pure types of the workspace-mode domain: the ONE home of the `workspaceMode`
 * projection-key declaration, free of this package's host-side value imports
 * (dsh-tools, schemastery). Two namespace projections serve it — `./types` for
 * host consumers, `./client` for client aggregates — with zero content
 * duplication.
 *
 * @module @deepseek-ai/dsh-workspace-modes/types
 */

/**
 * The arrangements this build offers. A mode names a shape, never a size: the
 * browser half owns what each id arranges, and the two sides are held
 * together by the catalogue below plus a spec that reads both.
 */
export type WorkspaceModeId = 'standard' | 'focus' | 'zen'

/** One session's recorded mode, and the event that recorded it. */
export interface WorkspaceModeState {
  /** The last mode this session asked its screen to show. */
  mode: WorkspaceModeId
  /**
   * Sequence number of the `workspace/mode` event that recorded it. Two
   * requests for the same mode are two instructions, and only the sequence
   * tells them apart; a renderer that applied by value alone would ignore the
   * second one.
   */
  at: number
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    workspaceMode: WorkspaceModeState | null
  }
  interface SessionProjectionMap {
    /**
     * The shape this session last asked the shell to take, or `null` before
     * the first request. Last event wins; `at` is that event's own sequence.
     */
    workspaceMode: WorkspaceModeState | null
  }
}
