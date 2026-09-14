/**
 * Client-namespace projection of the workspace-layout domain: a pure re-export
 * of the package's types outlet, whose single source also carries the
 * `workspaceLayout` projection-key declaration. Client code imports ONLY the
 * client namespace (repo discipline), so `./client` serves the browser
 * aggregates exactly what `./types` serves the host ones — zero duplication.
 *
 * @module @deepseek-ai/dsh-workspace-modes/client
 */

export type * from './types.ts'
