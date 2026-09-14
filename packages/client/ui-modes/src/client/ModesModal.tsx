/**
 * The mode picker. One row per mode, each naming the arrangement and what it
 * is for; the active row is marked rather than hidden, so the list stays a
 * stable map of the shapes available.
 */

import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceModeId } from '@deepseek-ai/dsh-workspace-modes/client'
import { MODE_ORDER } from './catalogue.ts'
import { modeDescriptionKey, modeNameKey } from './locales.ts'
import css from './ModesModal.module.css'

/** Props: the locale seat, the active mode, and the switch callback. */
export interface ModesModalProps extends PropsLocale<'modes'> {
  /** Whether the picker is showing. */
  open: boolean
  /** The mode this device class currently shows. */
  active: WorkspaceModeId
  /** Switch to a mode. */
  onSelect: (mode: WorkspaceModeId) => void
  /** Dismiss the picker. */
  onClose: () => void
}

/**
 * Render the mode picker.
 * @param props - picker state, the active mode, and the two gestures.
 * @returns the dialog, or null while closed.
 */
export function ModesModal({ open, active, onSelect, onClose, t }: ModesModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('modes.title')}
      closeLabel={t('modes.close')}
      description={t('modes.description')}
    >
      <ul className={css.list}>
        {MODE_ORDER.map(mode => (
          <li key={mode}>
            <button
              type="button"
              className={css.row}
              data-active={mode === active ? '' : undefined}
              aria-pressed={mode === active}
              onClick={() => { onSelect(mode) }}
            >
              <span className={css.rowText}>
                <span className={css.rowName}>{t(modeNameKey(mode))}</span>
                <span className={css.rowDescription}>{t(modeDescriptionKey(mode))}</span>
              </span>
              {mode === active && <span className={css.activeTag}>{t('modes.active')}</span>}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
