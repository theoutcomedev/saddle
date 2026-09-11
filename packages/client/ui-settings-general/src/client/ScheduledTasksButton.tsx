/**
 * Sidebar footer trigger button and modal owner for Scheduled Tasks.
 */

import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ScheduledTasksStore } from './schedules-store.ts'
import { ScheduledTasksModal } from './ScheduledTasksModal.tsx'
import css from './ScheduledTasksButton.module.css'

/** Crisp alarm / calendar-clock glyph for scheduled tasks */
export function IconScheduleOutline16({ size = 16, className }: { size?: number | undefined; className?: string | undefined }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 5.5V8.5L10 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.2 3.5L4.8 2M12.8 3.5L11.2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export interface ScheduledTasksButtonInjected {
  controller: ScheduledTasksStore
  hooks: {
    snapshot: ScheduledTasksStore['store']
  }
}

export interface ScheduledTasksButtonProps {
  wide?: boolean
  controller?: ScheduledTasksStore
  useSnapshot?: <T>(selector: (state: ReturnType<ScheduledTasksStore['store']['getSnapshot']>) => T) => T
}

export function ScheduledTasksButton({ wide = true, controller, useSnapshot }: ScheduledTasksButtonProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    controller?.refresh()
  }, [controller])

  const tasks = useSnapshot ? useSnapshot(s => s.tasks) : []
  const activeCount = tasks.filter(t => t.enabled).length

  const button = (
    <button
      type="button"
      className={clsx(css.trigger, !wide && css.triggerCollapsed)}
      aria-label="Scheduled Tasks"
      title={!wide ? 'Scheduled Tasks' : undefined}
      onClick={() => { setOpen(true) }}
    >
      <IconScheduleOutline16 size={16} className={css.icon} />
      {wide && <span className={css.label}>Scheduled Tasks</span>}
      {wide && activeCount > 0 && (
        <span className={css.countBadge}>{activeCount}</span>
      )}
    </button>
  )

  return (
    <>
      {!wide ? (
        <Tooltip label="Scheduled Tasks" delayMs={500}>
          {button}
        </Tooltip>
      ) : (
        button
      )}

      {open && controller && useSnapshot && (
        <ScheduledTasksModal
          store={controller}
          useSnapshot={useSnapshot}
          onClose={() => { setOpen(false) }}
        />
      )}
    </>
  )
}
