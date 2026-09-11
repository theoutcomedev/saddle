/**
 * Scheduled Tasks Orchestrator modal: monitor, create, trigger, and manage automated agent tasks.
 */

import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { Button, IconCloseOutline16, IconRefreshOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ScheduledTasksStore } from './schedules-store.ts'
import { IconScheduleOutline16 } from './ScheduledTasksButton.tsx'
import css from './ScheduledTasksModal.module.css'

export interface ScheduledTasksModalProps {
  store: ScheduledTasksStore
  useSnapshot: <T>(selector: (state: ReturnType<ScheduledTasksStore['store']['getSnapshot']>) => T) => T
  onClose: () => void
}

function IconPlay({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M4 2.5V13.5L13.5 8L4 2.5Z" />
    </svg>
  )
}

function IconPause({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M3.5 2.5H6.5V13.5H3.5V2.5ZM9.5 2.5H12.5V13.5H9.5V2.5Z" />
    </svg>
  )
}

function IconTrash({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden="true"
    >
      <path
        d="M2.5 4H13.5M5.5 4V2.5H10.5V4M6.5 7V11.5M9.5 7V11.5M3.5 4L4.5 13.5H11.5L12.5 4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconHistory({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden="true"
    >
      <path
        d="M8 3.5V8L10.5 10M14 8A6 6 0 1 1 12.2 3.8L14 2M14 2V5.5H10.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ScheduledTasksModal({ store, useSnapshot, onClose }: ScheduledTasksModalProps) {
  const { tasks, loading, activeLogs, actionInFlight } = useSnapshot(s => s)
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list')

  // Form states
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [cadenceType, setCadenceType] = useState<'interval' | 'cron'>('interval')
  const [intervalValue, setIntervalValue] = useState('30')
  const [cronValue, setCronValue] = useState('0 9 * * *')
  const [targetMode, setTargetMode] = useState<'new-session' | 'current-session'>('new-session')

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !prompt.trim()) return

    const cadenceValue = cadenceType === 'interval' ? intervalValue : cronValue
    const ok = await store.createTask({
      name: name.trim(),
      prompt: prompt.trim(),
      cadenceType,
      cadenceValue,
      targetMode,
    })

    if (ok) {
      setName('')
      setPrompt('')
      setActiveTab('list')
    }
  }

  const activeCount = tasks.filter(t => t.enabled).length

  return (
    <div className={css.mask} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={css.modal} role="dialog" aria-modal="true" aria-labelledby="schedules-title">
        <div className={css.header}>
          <div className={css.titleArea}>
            {activeLogs !== null ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => store.closeLogs()}
                  title="Back to task list"
                >
                  ← Back to Tasks
                </Button>
                <h2 id="schedules-title" className={css.title}>
                  Run History: {activeLogs.taskName}
                </h2>
              </>
            ) : activeTab === 'create' ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab('list')}
                  title="Back to task list"
                >
                  ← All Tasks
                </Button>
                <h2 id="schedules-title" className={css.title}>New Scheduled Task</h2>
              </>
            ) : (
              <>
                <h2 id="schedules-title" className={css.title}>Scheduled Tasks</h2>
                {tasks.length > 0 && (
                  <span className={css.badge}>{activeCount} active</span>
                )}
              </>
            )}
          </div>

          <div className={css.headerControls}>
            {activeLogs === null && activeTab === 'list' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setActiveTab('create')}
              >
                + New Task
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={() => { void store.refresh() }}
              title="Refresh tasks"
            >
              <IconRefreshOutline16 size={14} className={loading ? css.spin : undefined} />
            </Button>
            <button type="button" className={css.close} onClick={onClose} aria-label="Close">
              <IconCloseOutline16 size={14} />
            </button>
          </div>
        </div>

        <div className={css.content}>
          {activeLogs !== null ? (
            /* --- EXECUTION LOGS VIEW --- */
            <div className={css.logsOverlay}>
              {activeLogs.runs.length === 0 ? (
                <div className={css.emptyState}>
                  <p className={css.emptyDesc}>No execution runs recorded for this task yet.</p>
                </div>
              ) : (
                <div className={css.logsTableWrapper}>
                  <table className={css.logsTable}>
                    <thead>
                      <tr>
                        <th>Started At</th>
                        <th>Status</th>
                        <th>Finished At</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeLogs.runs.map(run => (
                        <tr key={run.id}>
                          <td>{new Date(run.startedAt).toLocaleString()}</td>
                          <td>
                            <span
                              className={clsx(
                                css.statusPill,
                                run.status === 'success' && css.statusActive,
                                run.status === 'failed' && css.statusPaused,
                                run.status === 'running' && css.statusRunning,
                              )}
                            >
                              {run.status}
                            </span>
                          </td>
                          <td>{run.finishedAt ? new Date(run.finishedAt).toLocaleTimeString() : '—'}</td>
                          <td>
                            {run.error ? (
                              <span style={{ color: '#ef4444' }}>{run.error}</span>
                            ) : run.outputSnippet ? (
                              <span>{run.outputSnippet}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : activeTab === 'create' ? (
            /* --- CREATE TASK VIEW --- */
            <form className={css.form} onSubmit={handleCreate}>
              <div className={css.formGroup}>
                <label className={css.formLabel} htmlFor="task-name">Task Name</label>
                <input
                  id="task-name"
                  type="text"
                  className={css.input}
                  placeholder="e.g. Daily Dependency & Security Audit"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              <div className={css.formGroup}>
                <label className={css.formLabel} htmlFor="task-prompt">Agent Prompt / Instruction</label>
                <textarea
                  id="task-prompt"
                  className={css.textarea}
                  placeholder={
                    'e.g. Run docker ps and verify all containers are healthy. '
                    + 'Check git status for uncommitted files. If any service is failing, diagnose findings.'
                  }
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  required
                />
                <span className={css.formHint}>
                  The agent will execute this instruction autonomously with full tool and filesystem access.
                </span>
              </div>

              <div className={css.formRow}>
                <div className={css.formGroup}>
                  <label className={css.formLabel}>Schedule Type</label>
                  <select
                    className={css.select}
                    value={cadenceType}
                    onChange={e => setCadenceType(e.target.value as 'interval' | 'cron')}
                  >
                    <option value="interval">Recurring Interval (minutes)</option>
                    <option value="cron">Standard Cron Expression</option>
                  </select>
                </div>

                <div className={css.formGroup}>
                  <label className={css.formLabel}>
                    {cadenceType === 'interval' ? 'Interval Duration' : 'Cron Syntax'}
                  </label>
                  {cadenceType === 'interval' ? (
                    <select
                      className={css.select}
                      value={intervalValue}
                      onChange={e => setIntervalValue(e.target.value)}
                    >
                      <option value="15">Every 15 minutes</option>
                      <option value="30">Every 30 minutes</option>
                      <option value="60">Every 1 hour</option>
                      <option value="120">Every 2 hours</option>
                      <option value="360">Every 6 hours</option>
                      <option value="720">Every 12 hours</option>
                      <option value="1440">Every 24 hours (Daily)</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      className={css.input}
                      placeholder="0 9 * * *"
                      value={cronValue}
                      onChange={e => setCronValue(e.target.value)}
                      required
                    />
                  )}
                  <span className={css.formHint}>
                    {cadenceType === 'cron'
                      ? 'Format: min hour day month dow (UTC)'
                      : 'Repeats continuously while server is running.'}
                  </span>
                </div>
              </div>

              <div className={css.formGroup}>
                <label className={css.formLabel}>Execution Mode</label>
                <select
                  className={css.select}
                  value={targetMode}
                  onChange={e => setTargetMode(e.target.value as 'new-session' | 'current-session')}
                >
                  <option value="new-session">Create a fresh isolated session per run (Recommended)</option>
                  <option value="current-session">Continue current workspace session</option>
                </select>
              </div>

              <div className={css.formActions}>
                <Button type="button" variant="ghost" onClick={() => setActiveTab('list')}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={actionInFlight === 'create'}>
                  {actionInFlight === 'create' ? 'Creating…' : 'Create Scheduled Task'}
                </Button>
              </div>
            </form>
          ) : tasks.length === 0 ? (
            /* --- EMPTY STATE --- */
            <div className={css.emptyState}>
              <IconScheduleOutline16 size={38} className={css.emptyIcon} />
              <h3 className={css.emptyTitle}>No Scheduled Tasks</h3>
              <p className={css.emptyDesc}>
                Automate recurring background tasks, daily health checks, deployment audits,
                and automated reporting that execute full agent turns autonomously.
              </p>
              <Button variant="primary" onClick={() => setActiveTab('create')}>
                + Create First Task
              </Button>
            </div>
          ) : (
            /* --- TASK LIST VIEW --- */
            <div className={css.cardList}>
              {tasks.map((task) => {
                const inFlight = actionInFlight === `trigger:${task.id}`
                  || actionInFlight === `toggle:${task.id}`
                  || actionInFlight === `delete:${task.id}`
                return (
                  <div key={task.id} className={css.card}>
                    <div className={css.cardTop}>
                      <div className={css.cardHeaderMain}>
                        <h4 className={css.taskName}>{task.name}</h4>
                        <span className={css.cadencePill}>
                          <IconScheduleOutline16 size={12} />
                          {task.cadenceLabel}
                        </span>
                        <span
                          className={clsx(
                            css.statusPill,
                            task.lastStatus === 'running'
                              ? css.statusRunning
                              : task.enabled
                                ? css.statusActive
                                : css.statusPaused,
                          )}
                        >
                          {task.lastStatus === 'running' ? 'Running now' : task.enabled ? 'Active' : 'Paused'}
                        </span>
                      </div>

                      <div className={css.cardActions}>
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={inFlight || task.lastStatus === 'running'}
                          title="Run now immediately"
                          onClick={() => { void store.triggerTask(task.id) }}
                        >
                          <IconPlay size={11} />
                          Run Now
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={inFlight}
                          title={task.enabled ? 'Pause task' : 'Resume task'}
                          onClick={() => { void store.toggleTask(task) }}
                        >
                          {task.enabled ? <IconPause size={11} /> : <IconPlay size={11} />}
                          {task.enabled ? 'Pause' : 'Resume'}
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          title="View run history"
                          onClick={() => { void store.openLogs(task.id, task.name) }}
                        >
                          <IconHistory size={12} />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={inFlight}
                          title="Delete task"
                          onClick={() => {
                            if (window.confirm(`Delete scheduled task "${task.name}"?`)) {
                              void store.deleteTask(task.id)
                            }
                          }}
                        >
                          <IconTrash size={12} />
                        </Button>
                      </div>
                    </div>

                    <div className={css.promptPreview}>
                      {task.prompt}
                    </div>

                    <div className={css.cardMeta}>
                      <span className={css.metaItem}>
                        Next Run:{' '}
                        <strong className={css.metaHighlight}>
                          {task.nextRunAt && task.enabled ? new Date(task.nextRunAt).toLocaleString() : 'Paused'}
                        </strong>
                      </span>
                      {task.lastRunAt && (
                        <span className={css.metaItem}>
                          Last Run:{' '}
                          <strong className={css.metaHighlight}>
                            {new Date(task.lastRunAt).toLocaleString()}
                          </strong>
                          {task.lastStatus && (
                            <span
                              style={{
                                color: task.lastStatus === 'success'
                                  ? '#22c55e'
                                  : task.lastStatus === 'failed'
                                    ? '#ef4444'
                                    : '#3b82f6',
                              }}
                            >
                              ({task.lastStatus})
                            </span>
                          )}
                        </span>
                      )}
                      {task.lastError && (
                        <span className={css.metaItem} style={{ color: '#ef4444' }}>
                          Error: {task.lastError}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
