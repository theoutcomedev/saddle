/**
 * Deployed Apps Control Center modal dialog.
 */

import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import { Button, IconCloseOutline16, IconRefreshOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DeployedAppsStore } from './apps-store.ts'
import { IconDeployOutline16 } from './DeployedAppsButton.tsx'
import css from './DeployedAppsModal.module.css'

export interface DeployedAppsModalProps {
  store: DeployedAppsStore
  useSnapshot: <T>(selector: (state: ReturnType<DeployedAppsStore['store']['getSnapshot']>) => T) => T
  onClose: () => void
}

export function DeployedAppsModal({ store, useSnapshot, onClose }: DeployedAppsModalProps) {
  const { apps, loading, activeLogs, actionInFlight } = useSnapshot(s => s)

  useEffect(() => {
    store.startPolling()
    return () => { store.stopPolling() }
  }, [store])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeLogs !== null) {
          store.closeLogs()
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [activeLogs, onClose, store])

  const terminalRef = useRef<HTMLPreElement | null>(null)
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [activeLogs?.logs])

  const runningCount = apps.filter(a => a.status === 'running').length

  return (
    <div className={css.mask} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={css.modal} role="dialog" aria-modal="true" aria-labelledby="deployed-apps-title">
        <div className={css.header}>
          <div className={css.titleArea}>
            <IconDeployOutline16 size={18} />
            <h2 id="deployed-apps-title" className={css.title}>Deployments</h2>
            {apps.length > 0 && (
              <span className={css.badge}>{runningCount} active</span>
            )}
          </div>
          <div className={css.headerControls}>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => { void store.refresh() }}
              title="Refresh apps"
            >
              <IconRefreshOutline16 size={14} className={loading ? css.spin : undefined} />
            </Button>
            <button type="button" className={css.close} onClick={onClose} aria-label="Close">
              <IconCloseOutline16 size={14} />
            </button>
          </div>
        </div>

        <div className={css.content}>
          {apps.length === 0 ? (
            <div className={css.emptyState}>
              <IconDeployOutline16 size={36} className={css.emptyIcon} />
              <h3 className={css.emptyTitle}>No Deployments</h3>
              <p className={css.emptyDesc}>
                You haven't deployed any apps yet. Ask Saddle in any session to build and host an application:
                <br />
                <em>"Create a React countdown timer and deploy it live."</em>
              </p>
            </div>
          ) : (
            <div className={css.grid}>
              {apps.map((app) => {
                const inFlight = actionInFlight?.endsWith(`:${app.id}`) || actionInFlight?.endsWith(`:${app.name}`)
                const isRunning = app.status === 'running'
                return (
                  <div key={app.id} className={css.card}>
                    <div className={css.cardHeader}>
                      <div>
                        <h4 className={css.appName}>{app.name.replace(/[-_]/g, ' ')}</h4>
                        <a
                          href={app.url}
                          target="_blank"
                          rel="noreferrer"
                          className={css.appUrl}
                          title="Open live public URL in new tab"
                        >
                          {app.url.replace(/^https?:\/\//, '').replace(/\/$/, '')} ↗
                        </a>
                      </div>
                      <span className={clsx(css.statusIndicator, isRunning ? css.statusRunning : css.statusStopped)}>
                        <span className={css.statusDot} />
                        {app.status}
                      </span>
                    </div>

                    <div className={css.metaRow}>
                      {app.port !== undefined && (
                        <span className={css.metaItem}>Port: {app.port}</span>
                      )}
                      {app.uptime && (
                        <span className={css.metaItem}>{app.uptime}</span>
                      )}
                    </div>

                    <div className={css.cardActions}>
                      <a
                        href={app.url}
                        target="_blank"
                        rel="noreferrer"
                        className={css.openBtn}
                      >
                        Open App ↗
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { void store.openLogs(app.id) }}
                      >
                        Logs
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={inFlight}
                        onClick={() => { void store.restart(app.id) }}
                      >
                        Restart
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={inFlight}
                        onClick={() => {
                          if (window.confirm(`Stop and delete container "${app.name}"?`)) {
                            void store.delete(app.id)
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {activeLogs !== null && (
          <div className={css.logsOverlay}>
            <div className={css.header}>
              <div className={css.titleArea}>
                <h3 className={css.title}>Logs: {activeLogs.name}</h3>
              </div>
              <div className={css.headerControls}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { void navigator.clipboard.writeText(activeLogs.logs) }}
                >
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { store.closeLogs() }}
                >
                  Close
                </Button>
              </div>
            </div>
            <pre ref={terminalRef} className={css.logsTerminal}>
              {activeLogs.logs}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
