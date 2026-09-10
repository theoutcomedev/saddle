// Workbench background-job pane: shows the list of this session's jobs, or
// the detail view for a specific job when params.jobId is set.

import { useState } from 'react'
import type { JobView } from '@deepseek-ai/dsh-client-runtime/client'
import { StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from './contract/slots.ts'
import { NS } from './locales.ts'
import css from './jobs-pane.module.css'

export type JobsPaneProps = PropsRuntime<'workbench.pane.jobs'> & PropsLocale<typeof NS>

const NO_JOBS: readonly JobView[] = []

function dotStateClass(status: JobView['status']): 'ongoing' | 'done' | 'error' | 'warning' {
  switch (status) {
    case 'running': return 'ongoing'
    case 'stopping': return 'warning'
    case 'completed': return 'done'
    case 'killed': return 'warning'
    case 'failed': return 'error'
  }
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1_000))
  const seconds = total % 60
  const minutes = Math.floor(total / 60) % 60
  const hours = Math.floor(total / 3_600)
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function JobsPane({ sessionId, useSessions, params }: JobsPaneProps) {
  const jobs = useSessions(state => (sessionId ? state.jobsBySession[sessionId] : undefined)) ?? NO_JOBS
  const [selectedId, setSelectedId] = useState<string | null>(
    () => (typeof params?.jobId === 'string' ? params.jobId : null),
  )

  // When params.jobId changes (new event fired), honour the new value
  const paramJobId = typeof params?.jobId === 'string' ? params.jobId : null
  const resolvedSelectedId = paramJobId ?? selectedId

  if (resolvedSelectedId !== null) {
    const job = jobs.find(j => j.id === resolvedSelectedId)
    if (job !== undefined) {
      const duration = job.finishedAt !== undefined
        ? formatDuration(job.finishedAt - job.startedAt)
        : formatDuration(Date.now() - job.startedAt)
      return (
        <div className={css.detail}>
          <button
            type="button"
            className={css.backBtn}
            onClick={() => setSelectedId(null)}
          >
            ← All jobs
          </button>
          <div className={css.detailHeader}>
            <StateDot state={dotStateClass(job.status)} />
            <span className={css.detailKind}>{job.kind}</span>
            <span className={css.detailStatus}>{job.detail ?? job.status}</span>
          </div>
          <p className={css.detailLabel}>{job.label}</p>
          <div className={css.detailMeta}>
            <span className={css.detailMetaKey}>Started</span>
            <span className={css.detailMetaVal}>{new Date(job.startedAt).toLocaleTimeString()}</span>
            {job.finishedAt !== undefined && (
              <>
                <span className={css.detailMetaKey}>Finished</span>
                <span className={css.detailMetaVal}>{new Date(job.finishedAt).toLocaleTimeString()}</span>
              </>
            )}
            <span className={css.detailMetaKey}>Duration</span>
            <span className={css.detailMetaVal}>{duration}</span>
            <span className={css.detailMetaKey}>Status</span>
            <span className={css.detailMetaVal}>{job.status}</span>
            {job.detail !== undefined && (
              <>
                <span className={css.detailMetaKey}>Detail</span>
                <span className={css.detailMetaVal}>{job.detail}</span>
              </>
            )}
          </div>
          <div className={css.detailCommand}>
            <span className={css.detailCommandLabel}>Command</span>
            <pre className={css.detailCommandText}>{job.label}</pre>
          </div>
        </div>
      )
    }
  }

  if (jobs.length === 0) {
    return <div className={css.empty}>No background jobs.</div>
  }
  return (
    <ul className={css.list}>
      {jobs.map(job => (
        <li
          key={job.id}
          className={`${css.row} ${css.rowClickable}`}
          role="button"
          tabIndex={0}
          title="View job details"
          onClick={() => setSelectedId(job.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setSelectedId(job.id)
            }
          }}
        >
          <StateDot state={dotStateClass(job.status)} />
          <span className={css.kind}>{job.kind}</span>
          <span className={css.label} title={job.label}>{job.label}</span>
          <span className={css.status}>{job.detail ?? job.status}</span>
        </li>
      ))}
    </ul>
  )
}
