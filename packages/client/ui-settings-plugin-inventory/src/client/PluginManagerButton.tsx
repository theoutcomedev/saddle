import { useState } from 'react'
import clsx from 'clsx'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PluginInventorySnapshot } from '@deepseek-ai/dsh-api-remotes/client'
import { PluginManagerModal } from './PluginManagerModal.tsx'
import css from './PluginManagerButton.module.css'

export function IconPuzzleOutline16({ size = 16, className }: { size?: number | undefined; className?: string | undefined }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M10.5 4.5V3.5C10.5 2.11929 9.38071 1 8 1C6.61929 1 5.5 2.11929 5.5 3.5V4.5H3.5C2.39543 4.5 1.5 5.39543 1.5 6.5V8.5C2.88071 8.5 4 9.61929 4 11C4 12.3807 2.88071 13.5 1.5 13.5V14.5C1.5 15.6046 2.39543 16.5 3.5 16.5H5.5V15.5C5.5 14.1193 6.61929 13 8 13C9.38071 13 10.5 14.1193 10.5 15.5V16.5H12.5C13.6046 16.5 14.5 15.6046 14.5 14.5V12.5H13.5C12.1193 12.5 11 11.3807 11 10C11 8.61929 12.1193 7.5 13.5 7.5H14.5V5.5C14.5 4.39543 13.6046 3.5 12.5 3.5H10.5V4.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}


export interface PluginManagerButtonProps {
  wide?: boolean
  list?: (() => Promise<PluginInventorySnapshot>) | undefined
  toggle?: ((entryId: string, enabled: boolean) => Promise<void>) | undefined
}

export function PluginManagerButton({ wide = true, list, toggle }: PluginManagerButtonProps) {
  const [open, setOpen] = useState(false)

  const button = (
    <button
      type="button"
      className={clsx(css.trigger, !wide && css.triggerCollapsed)}
      aria-label="Plugins"
      title={!wide ? 'Plugins' : undefined}
      onClick={() => { setOpen(true) }}
    >
      <IconPuzzleOutline16 size={16} className={css.icon} />
      {wide && <span className={css.label}>Plugins</span>}
    </button>
  )

  return (
    <>
      {!wide ? (
        <Tooltip label="Plugins" delayMs={500}>
          {button}
        </Tooltip>
      ) : (
        button
      )}

      {open && (
        <PluginManagerModal
          list={list}
          toggle={toggle}
          onClose={() => { setOpen(false) }}
        />
      )}
    </>
  )
}
