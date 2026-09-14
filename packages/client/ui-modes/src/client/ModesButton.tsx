/**
 * The sidebar's Modes row: the entrance a person uses, beside Deployments and
 * Scheduled Tasks. It owns the picker's open state and nothing else — the
 * active mode comes from the shared modes face.
 */

import { useState } from 'react'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceModeId } from '@deepseek-ai/dsh-workspace-modes/client'
import { ModesModal } from './ModesModal.tsx'
import type { ModesInjected } from './index.ts'
import css from './ModesButton.module.css'

/** Three-column frame glyph: the arrangement the row opens onto. */
function IconLayoutOutline16({ size = 16, className }: { size?: number | undefined; className?: string | undefined }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="1.9" y="2.9" width="12.2" height="10.2" rx="1.6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6.1 2.9V13.1M9.9 2.9V13.1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

/** Props: the sidebar footer seat, the modes face, and the locale seat. */
export type ModesButtonProps =
  PropsLocale<'modes'>
  & InjectFace<ModesInjected>
  & {
    /** False when the sidebar is collapsed to its rail. */
    wide?: boolean | undefined
  }

/**
 * Render the Modes row and its picker.
 * @param props - composed slot props.
 * @returns the trigger plus the dialog it owns.
 */
export function ModesButton({ wide = true, useModes, apply, t }: ModesButtonProps) {
  const [open, setOpen] = useState(false)
  const active = useModes(state => state.active)
  const label = t('modes.row')

  return (
    <>
      <button
        type="button"
        className={`${css.trigger}${wide ? '' : ` ${css.triggerCollapsed}`}`}
        aria-label={label}
        title={!wide ? label : undefined}
        onClick={() => { setOpen(true) }}
      >
        <IconLayoutOutline16 size={16} className={css.icon} />
        {wide && <span className={css.label}>{label}</span>}
      </button>
      <ModesModal
        open={open}
        active={active}
        t={t}
        onSelect={(mode: WorkspaceModeId) => { apply(mode); setOpen(false) }}
        onClose={() => { setOpen(false) }}
      />
    </>
  )
}
