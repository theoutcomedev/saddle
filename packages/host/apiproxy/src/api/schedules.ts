/**
 * schedules domain contract: API for managing, scheduling, and running automated agent tasks.
 */

import type { RpcRequest, RpcResponse } from './rpc.ts'

export interface ScheduledTaskView {
  id: string
  name: string
  prompt: string
  /** 'cron' | 'interval' | 'once' */
  cadenceType: 'cron' | 'interval' | 'once'
  /** Cron expression (e.g. '0 9 * * *') or interval in minutes (e.g. '30') */
  cadenceValue: string
  /** Human friendly summary, e.g. "Every 30 minutes", "Daily at 09:00 UTC" */
  cadenceLabel: string
  enabled: boolean
  targetMode: 'new-session' | 'current-session'
  sessionId?: string | undefined
  workspacePath?: string | undefined
  clientTimeZone?: string | undefined
  createdAt: string
  lastRunAt?: string | undefined
  lastStatus?: 'success' | 'failed' | 'running' | undefined
  lastError?: string | undefined
  nextRunAt?: string | undefined
}

export interface TaskRunLogEntry {
  id: string
  taskId: string
  startedAt: string
  finishedAt?: string | undefined
  status: 'success' | 'failed' | 'running'
  sessionId?: string | undefined
  outputSnippet?: string | undefined
  error?: string | undefined
}

export interface SchedulesApi {
  /** List all configured scheduled tasks. */
  list(request: RpcRequest<{}>): Promise<RpcResponse<{ tasks: ScheduledTaskView[] }>>

  /** Create a new scheduled task. */
  create(request: RpcRequest<{
    name: string
    prompt: string
    cadenceType: 'cron' | 'interval' | 'once'
    cadenceValue: string
    targetMode?: 'new-session' | 'current-session' | undefined
    sessionId?: string | undefined
    workspacePath?: string | undefined
    clientTimeZone?: string | undefined
  }>): Promise<RpcResponse<{ task: ScheduledTaskView }>>

  /** Update or toggle an existing scheduled task. */
  update(request: RpcRequest<{
    id: string
    name?: string | undefined
    prompt?: string | undefined
    cadenceType?: 'cron' | 'interval' | 'once' | undefined
    cadenceValue?: string | undefined
    enabled?: boolean | undefined
    targetMode?: 'new-session' | 'current-session' | undefined
  }>): Promise<RpcResponse<{ task: ScheduledTaskView }>>

  /** Delete a scheduled task. */
  delete(request: RpcRequest<{ id: string }>): Promise<RpcResponse<{ success: boolean }>>

  /** Manually trigger a scheduled task immediately ("Run Now"). */
  trigger(request: RpcRequest<{ id: string }>): Promise<RpcResponse<{ runId: string; status: string }>>

  /** Get execution history logs for a task. */
  logs(request: RpcRequest<{ taskId: string }>): Promise<RpcResponse<{ runs: TaskRunLogEntry[] }>>
}
