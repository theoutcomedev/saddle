// Workbench background-job pane: an always-visible list of this session's jobs
// over the jobsBySession mirror. Read-only for now - a human-initiated
// Stop remains a deferred phase (the model-facing cancellation contract is
// unresolved), so the pane shows status and duration only.

import type { JobView } from '@deepseek-ai/dsh-client-runtime/client'
import { StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from './contract/slots.ts'
import { NS } from './locales.ts'
import css from './jobs-pane.module.css'

export type JobsPaneProps = PropsRuntime<'workbench.pane.jobs'> & PropsLocale<typeof NS>

const NO_JOBS: readonly JobView[] = []

export function JobsPane({ sessionId, useSessions }: JobsPaneProps) {
  const jobs = useSessions(state => state.jobsBySession[sessionId]) ?? NO_JOBS
  if (jobs.length === 0) {
    return <div className={css.empty}>No background jobs.</div>
  }
  return (
    <ul className={css.list}>
      {jobs.map(job => (
        <li key={job.id} className={css.row}>
          <StateDot state={job.status === 'running' ? 'ongoing' : job.status === 'completed' ? 'done' : job.status === 'failed' ? 'error' : 'warning'} />
          <span className={css.kind}>{job.kind}</span>
          <span className={css.label} title={job.label}>{job.label}</span>
          <span className={css.status}>{job.detail ?? job.status}</span>
        </li>
      ))}
    </ul>
  )
}
