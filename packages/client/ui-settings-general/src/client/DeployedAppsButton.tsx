/**
 * Sidebar footer trigger button and modal owner for Deployed Apps.
 */

import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DeployedAppsStore } from './apps-store.ts'
import { DeployedAppsModal } from './DeployedAppsModal.tsx'
import css from './DeployedAppsButton.module.css'

/** Clean 16x16 App Grid icon matching Saddle design system. */
export function IconAppsOutline16({ size = 16, className }: { size?: number | undefined; className?: string | undefined }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="4.8" height="4.8" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9.2" y="2" width="4.8" height="4.8" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2" y="9.2" width="4.8" height="4.8" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9.2" y="9.2" width="4.8" height="4.8" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
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
      <IconAppsOutline16 size={16} className={css.icon} />
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
