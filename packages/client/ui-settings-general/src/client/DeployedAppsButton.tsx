/**
 * Sidebar footer trigger button and modal owner for Deployed Apps.
 */

import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DeployedAppsStore } from './apps-store.ts'
import { DeployedAppsModal } from './DeployedAppsModal.tsx'
import css from './DeployedAppsButton.module.css'

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
      aria-label="Deployed Apps"
      title={!wide ? 'Deployed Apps' : undefined}
      onClick={() => { setOpen(true) }}
    >
      <span className={css.icon} aria-hidden="true">🚀</span>
      {wide && <span className={css.label}>Deployed Apps</span>}
      {wide && runningCount > 0 && (
        <span className={css.countBadge}>{runningCount}</span>
      )}
    </button>
  )

  return (
    <>
      {!wide ? (
        <Tooltip label="Deployed Apps" delayMs={500}>
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
