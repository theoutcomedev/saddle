/**
 * The layout picker. One row per layout *this device offers*, each naming the
 * shape and what it is for; the active row is marked rather than hidden, so the
 * list stays a map of the shapes available. The title says "workspace layout" in
 * full, because the sidebar already uses "mode" for the assistant's presets.
 */

import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceLayoutId } from '@deepseek-ai/dsh-workspace-modes/client'
import { layoutDescriptionKey, layoutNameKey } from './locales.ts'
import css from './LayoutsModal.module.css'

/** Props: the locale seat, the offered layouts, the active one, and the switch callback. */
export interface LayoutsModalProps extends PropsLocale<'layouts'> {
  /** Whether the picker is showing. */
  open: boolean
  /** The layouts this device offers, in catalogue order. */
  offered: readonly WorkspaceLayoutId[]
  /** The layout this device class currently shows. */
  active: WorkspaceLayoutId
  /** Switch to a layout. */
  onSelect: (layout: WorkspaceLayoutId) => void
  /** Dismiss the picker. */
  onClose: () => void
}

/**
 * Render the layout picker.
 * @param props - picker state, the offered layouts, and the two gestures.
 * @returns the dialog, or null while closed.
 */
export function LayoutsModal({ open, offered, active, onSelect, onClose, t }: LayoutsModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('layouts.title')}
      closeLabel={t('layouts.close')}
      description={t('layouts.description')}
    >
      <ul className={css.list}>
        {offered.map(layout => (
          <li key={layout}>
            <button
              type="button"
              className={css.row}
              data-active={layout === active ? '' : undefined}
              aria-pressed={layout === active}
              onClick={() => { onSelect(layout) }}
            >
              <span className={css.rowText}>
                <span className={css.rowName}>{t(layoutNameKey(layout))}</span>
                <span className={css.rowDescription}>{t(layoutDescriptionKey(layout))}</span>
              </span>
              {layout === active && <span className={css.activeTag}>{t('layouts.active')}</span>}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
