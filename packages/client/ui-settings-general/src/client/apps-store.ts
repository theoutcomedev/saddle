/**
 * State store for discovering, monitoring, and managing deployed applications.
 */

import type { ApiProxy, DeployedAppView } from '@deepseek-ai/dsh-host-apiproxy/api'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

export interface DeployedAppsState {
  apps: DeployedAppView[]
  loading: boolean
  error: string | null
  activeLogs: { name: string; logs: string; loading: boolean } | null
  actionInFlight: string | null
}

export class DeployedAppsStore {
  readonly store: SnapshotStore<DeployedAppsState> = createSnapshotStore({
    apps: [],
    loading: false,
    error: null,
    activeLogs: null,
    actionInFlight: null,
  })

  private timer: number | undefined

  constructor(private readonly api: ApiProxy) {}

  async refresh(): Promise<void> {
    this.store.update((state) => {
      state.loading = true
      state.error = null
    })

    try {
      const response = await this.api.apps.list({})
      if (response.result.ok) {
        this.store.update((state) => {
          state.apps = response.result.value.apps
          state.loading = false
          state.error = null
        })
      } else {
        this.store.update((state) => {
          state.loading = false
          state.error = response.result.error?.message || 'Failed to load deployed apps'
        })
      }
    } catch (error) {
      this.store.update((state) => {
        state.loading = false
        state.error = error instanceof Error ? error.message : String(error)
      })
    }
  }

  startPolling(intervalMs = 10000): void {
    void this.refresh()
    if (this.timer === undefined) {
      this.timer = window.setInterval(() => {
        void this.refresh()
      }, intervalMs)
    }
  }

  stopPolling(): void {
    if (this.timer !== undefined) {
      window.clearInterval(this.timer)
      this.timer = undefined
    }
  }

  async restart(name: string): Promise<boolean> {
    this.store.update((state) => { state.actionInFlight = `restart:${name}` })
    try {
      const response = await this.api.apps.restart({ name })
      await this.refresh()
      return response.result.ok && response.result.value.success
    } catch {
      return false
    } finally {
      this.store.update((state) => { state.actionInFlight = null })
    }
  }

  async stop(name: string): Promise<boolean> {
    this.store.update((state) => { state.actionInFlight = `stop:${name}` })
    try {
      const response = await this.api.apps.stop({ name })
      await this.refresh()
      return response.result.ok && response.result.value.success
    } catch {
      return false
    } finally {
      this.store.update((state) => { state.actionInFlight = null })
    }
  }

  async delete(name: string): Promise<boolean> {
    this.store.update((state) => { state.actionInFlight = `delete:${name}` })
    try {
      const response = await this.api.apps.delete({ name })
      await this.refresh()
      return response.result.ok && response.result.value.success
    } catch {
      return false
    } finally {
      this.store.update((state) => { state.actionInFlight = null })
    }
  }

  async openLogs(name: string): Promise<void> {
    this.store.update((state) => {
      state.activeLogs = { name, logs: 'Loading logs...', loading: true }
    })
    try {
      const response = await this.api.apps.logs({ name, tail: 150 })
      const logs = response.result.ok ? response.result.value.logs : 'Failed to fetch logs.'
      this.store.update((state) => {
        if (state.activeLogs?.name === name) {
          state.activeLogs = { name, logs, loading: false }
        }
      })
    } catch (error) {
      this.store.update((state) => {
        if (state.activeLogs?.name === name) {
          state.activeLogs = { name, logs: `Error: ${error instanceof Error ? error.message : String(error)}`, loading: false }
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
