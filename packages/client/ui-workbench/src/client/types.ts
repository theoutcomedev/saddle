/**
 * Workbench shared types. This module is types-only: no runtime code.
 */

/** A pane kind the Workbench can host and the add menu can offer. */
export type WorkbenchPaneKind = 'details' | 'jobs' | 'browser' | 'files' | 'app'

/** One open tab in the Workbench: a stable id plus the kind it renders. */
export interface WorkbenchOpenTab {
  /** Stable per-open-instance id (a repeated kind opens one tab, keyed by it). */
  id: string
  /** Pane kind this tab renders. */
  kind: WorkbenchPaneKind
}

/** Open-instance params carried through the pane owner share (a File pane's path, an App pane's id/metadata). */
export interface WorkbenchPaneParams {
  /** Target path for a path-bearing pane (File/Explorer). */
  path?: string | undefined
  /** Initial URL for the browser pane. */
  url?: string | undefined
  /** Application ID for an app pane (e.g. 'notepad'). */
  appId?: string | undefined
  /** Display title for an app pane (e.g. 'Notepad'). */
  appTitle?: string | undefined
  /** Display icon for an app pane (e.g. '📝'). */
  appIcon?: string | undefined
  /** Target job ID to focus in the jobs pane. */
  jobId?: string | undefined
}
