/**
 * State store for discovering, monitoring, and managing automated scheduled tasks.
 */

import type { ScheduledTaskView, TaskRunLogEntry } from '@deepseek-ai/dsh-host-apiproxy/api'
import type { IApiClient } from '@deepseek-ai/dsh-host-apiproxy/client'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

export interface ScheduledTasksState {
  tasks: ScheduledTaskView[]
  loading: boolean
  error: string | null
  activeLogs: { taskId: string; taskName: string; runs: TaskRunLogEntry[]; loading: boolean } | null
  actionInFlight: string | null
}

export class ScheduledTasksStore {
  readonly store: SnapshotStore<ScheduledTasksState> = createSnapshotStore({
    tasks: [],
    loading: false,
    error: null,
    activeLogs: null,
    actionInFlight: null,
  })

  private timer: number | undefined

  constructor(private readonly api: IApiClient) {}

  async refresh(silent = false): Promise<void> {
    if (!silent) {
      this.store.update((state) => {
        state.loading = true
        state.error = null
      })
    }

    try {
      const response = await this.api.schedules.list({})
      if (response.result.ok) {
        const tasks = response.result.value.tasks
        this.store.update((state) => {
          state.tasks = tasks
          state.loading = false
          state.error = null
        })
      } else {
        const errorMsg = response.result.error.message
        this.store.update((state) => {
          state.loading = false
          state.error = errorMsg || 'Failed to load scheduled tasks'
        })
      }
    } catch (error) {
      this.store.update((state) => {
        state.loading = false
        state.error = error instanceof Error ? error.message : String(error)
      })
    } finally {
      this.store.update((state) => {
        state.loading = false
      })
    }
  }

  startPolling(intervalMs = 8000): void {
    if (this.timer !== undefined) return
    void this.refresh(true)
    this.timer = window.setInterval(() => {
      void this.refresh(true)
    }, intervalMs)
  }

  stopPolling(): void {
    if (this.timer !== undefined) {
      window.clearInterval(this.timer)
      this.timer = undefined
    }
  }

  async listSessions(): Promise<Array<{ id: string; title: string; cwd?: string | undefined }>> {
    try {
      const res = await this.api.sessions.list({})
      if (res.result.ok) {
        return res.result.value.items.map((s) => {
          const vals = s.projections?.values as Record<string, unknown> | undefined
          const projTitle = vals?.['title']
          const sObj = s as { title?: unknown }
          const titleProp = typeof sObj.title === 'string' && sObj.title.trim() ? sObj.title.trim() : undefined
          const titleCandidate = titleProp || ((typeof projTitle === 'string' && projTitle.trim()) ? projTitle.trim() : undefined)
          const folder = s.cwd ? (s.cwd.split('/').filter(Boolean).pop() || s.cwd) : undefined
          const title = titleCandidate || folder || `Session ${String(s.sessionId).slice(0, 8)}`
          return {
            id: String(s.sessionId),
            title,
            cwd: s.cwd !== undefined ? s.cwd : undefined,
          }
        })
      }
      return []
    } catch {
      return []
    }
  }

  async listWorkspaces(): Promise<Array<{ id: string; title: string; path: string }>> {
    try {
      const res = await this.api.workspace.list({})
      if (res.result.ok) {
        return res.result.value.items.map((w: { workspaceId: string; title: string; path: string }) => ({
          id: String(w.workspaceId),
          title: w.title,
          path: w.path,
        }))
      }
      return []
    } catch {
      return []
    }
  }

  async createTask(params: {
    name: string
    prompt: string
    cadenceType: 'cron' | 'interval' | 'once'
    cadenceValue: string
    targetMode?: 'new-session' | 'current-session' | undefined
    sessionId?: string | undefined
    workspacePath?: string | undefined
    clientTimeZone?: string | undefined
  }): Promise<boolean> {
    this.store.update((state) => {
      state.actionInFlight = 'create'
      state.error = null
    })

    try {
      const response = await this.api.schedules.create(params)
      if (response.result.ok) {
        await this.refresh()
        return true
      } else {
        const errorMsg = response.result.error.message
        this.store.update((state) => {
          state.error = errorMsg || 'Failed to create task'
        })
        return false
      }
    } catch (error) {
      this.store.update((state) => {
        state.error = error instanceof Error ? error.message : String(error)
      })
      return false
    } finally {
      this.store.update((state) => {
        state.actionInFlight = null
      })
    }
  }

  async toggleTask(task: ScheduledTaskView): Promise<void> {
    this.store.update((state) => {
      state.actionInFlight = `toggle:${task.id}`
      state.error = null
    })

    try {
      const response = await this.api.schedules.update({
        id: task.id,
        enabled: !task.enabled,
      })
      if (response.result.ok) {
        await this.refresh()
      } else {
        const errorMsg = response.result.error.message
        this.store.update((state) => {
          state.error = errorMsg || 'Failed to toggle task'
        })
      }
    } catch (error) {
      this.store.update((state) => {
        state.error = error instanceof Error ? error.message : String(error)
      })
    } finally {
      this.store.update((state) => {
        state.actionInFlight = null
      })
    }
  }

  async deleteTask(id: string): Promise<void> {
    this.store.update((state) => {
      state.actionInFlight = `delete:${id}`
      state.error = null
    })

    try {
      const response = await this.api.schedules.delete({ id })
      if (response.result.ok) {
        await this.refresh()
      } else {
        const errorMsg = response.result.error.message
        this.store.update((state) => {
          state.error = errorMsg || 'Failed to delete task'
        })
      }
    } catch (error) {
      this.store.update((state) => {
        state.error = error instanceof Error ? error.message : String(error)
      })
    } finally {
      this.store.update((state) => {
        state.actionInFlight = null
      })
    }
  }

  async triggerTask(id: string): Promise<void> {
    this.store.update((state) => {
      state.actionInFlight = `trigger:${id}`
      state.error = null
    })

    try {
      const response = await this.api.schedules.trigger({ id })
      if (response.result.ok) {
        await this.refresh()
      } else {
        const errorMsg = response.result.error.message
        this.store.update((state) => {
          state.error = errorMsg || 'Failed to trigger task'
        })
      }
    } catch (error) {
      this.store.update((state) => {
        state.error = error instanceof Error ? error.message : String(error)
      })
    } finally {
      this.store.update((state) => {
        state.actionInFlight = null
      })
    }
  }

  async openLogs(taskId: string, taskName: string): Promise<void> {
    this.store.update((state) => {
      state.activeLogs = { taskId, taskName, runs: [], loading: true }
    })

    try {
      const response = await this.api.schedules.logs({ taskId })
      if (response.result.ok) {
        const runs = response.result.value.runs
        this.store.update((state) => {
          if (state.activeLogs && state.activeLogs.taskId === taskId) {
            state.activeLogs.runs = runs
            state.activeLogs.loading = false
          }
        })
      }
    } catch {
      this.store.update((state) => {
        if (state.activeLogs && state.activeLogs.taskId === taskId) {
          state.activeLogs.loading = false
        }
      })
    }
  }

  closeLogs(): void {
    this.store.update((state) => {
      state.activeLogs = null
    })
  }

  dispose(): void {
    this.stopPolling()
  }
}
