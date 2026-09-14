/**
 * The sidebar's Layout row: the entrance a person uses, beside Deployments and
 * Scheduled Tasks. It owns the picker's open state and nothing else — the
 * active layout comes from the shared layouts face.
 */

import { useState } from 'react'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceLayoutId } from '@deepseek-ai/dsh-workspace-modes/client'
import { LayoutGlyph } from './LayoutGlyph.tsx'
import { LayoutsModal } from './LayoutsModal.tsx'
import type { LayoutsInjected } from './index.ts'
import css from './LayoutsButton.module.css'

/** Props: the sidebar footer seat, the layouts face, and the locale seat. */
export type LayoutsButtonProps =
  PropsLocale<'layouts'>
  & InjectFace<LayoutsInjected>
  & {
    /** False when the sidebar is collapsed to its rail. */
    wide?: boolean | undefined
  }

/**
 * Render the Layout row and its picker.
 * @param props - composed slot props.
 * @returns the trigger plus the dialog it owns.
 */
export function LayoutsButton({ wide = true, useLayouts, apply, t }: LayoutsButtonProps) {
  const [open, setOpen] = useState(false)
  const active = useLayouts(state => state.active)
  const label = t('layouts.row')

  return (
    <>
      <button
        type="button"
        className={`${css.trigger}${wide ? '' : ` ${css.triggerCollapsed}`}`}
        aria-label={label}
        title={!wide ? label : undefined}
        onClick={() => { setOpen(true) }}
      >
        <LayoutGlyph size={16} className={css.icon} />
        {wide && <span className={css.label}>{label}</span>}
      </button>
      <LayoutsModal
        open={open}
        active={active}
        t={t}
        onSelect={(layout: WorkspaceLayoutId) => { apply(layout); setOpen(false) }}
        onClose={() => { setOpen(false) }}
      />
    </>
  )
}
