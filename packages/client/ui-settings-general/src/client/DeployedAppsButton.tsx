/**
 * Sidebar footer trigger button and modal owner for Deployed Apps.
 */

import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DeployedAppsStore } from './apps-store.ts'
import { DeployedAppsModal } from './DeployedAppsModal.tsx'
import css from './DeployedAppsButton.module.css'

/** Rocket (deploy) glyph, visually distinct from the Apps grid icon. */
export function IconDeployOutline16({ size = 16, className }: { size?: number | undefined; className?: string | undefined }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M8 1.5 5.3 7.3 6 10.7h4l.7-3.4L8 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="8" cy="5.7" r="1.05" stroke="currentColor" strokeWidth="1.1" />
      <path d="M6.2 10.7 4 13.3l2-.3M9.8 10.7 12 13.3l-2-.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.9 10.7l-.4 2.2 1.5-.9 1.5.9-.4-2.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export interface DeployedAppsButtonInjected {
  controller: DeployedAppsStore
  hooks: {
    snapshot: DeployedAppsStore['store']
  }
}

export interface DeployedAppsButtonProps {
  wide?: boolean
  controller?: DeployedAppsStore
  useSnapshot?: <T>(selector: (state: ReturnType<DeployedAppsStore['store']['getSnapshot']>) => T) => T
}

export function DeployedAppsButton({ wide = true, controller, useSnapshot }: DeployedAppsButtonProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    controller?.refresh()
  }, [controller])

  const apps = useSnapshot ? useSnapshot(s => s.apps) : []
  const runningCount = apps.filter(a => a.status === 'running').length

  const button = (
    <button
      type="button"
      className={clsx(css.trigger, !wide && css.triggerCollapsed)}
      aria-label="Deployments"
      title={!wide ? 'Deployments' : undefined}
      onClick={() => { setOpen(true) }}
    >
      <IconDeployOutline16 size={16} className={css.icon} />
      {wide && <span className={css.label}>Deployments</span>}
      {wide && runningCount > 0 && (
        <span className={css.countBadge}>{runningCount}</span>
      )}
    </button>
  )

  return (
    <>
      {!wide ? (
        <Tooltip label="Deployments" delayMs={500}>
          {button}
        </Tooltip>
      ) : (
        button
      )}

      {open && controller && useSnapshot && (
        <DeployedAppsModal
          store={controller}
          useSnapshot={useSnapshot}
          onClose={() => { setOpen(false) }}
        />
      )}
    </>
  )
}
