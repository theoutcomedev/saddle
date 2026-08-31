import { useState } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ChatViewSlotProps } from '../contract/slots.ts'
import css from './RewindConfirm.module.css'

export interface RewindConfirmProps {
  open: boolean
  onCancel: () => void
  onConfirm: (revertFiles: boolean) => void
  t: ChatViewSlotProps['t']
}

/**
 * Rewind confirmation: reverts the conversation to the anchor message by
 * forking a continuation (the source stays in the list, so the rewind is
 * regret-safe) and optionally restores every file the agent mutated after
 * that point back to its before-state.
 */
export function RewindConfirm({ open, onCancel, onConfirm, t }: RewindConfirmProps) {
  const [revertFiles, setRevertFiles] = useState(false)
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={t('rewind.title')}
      className={css.modal ?? ''}
      contentClassName={css.content ?? ''}
      footer={(
        <>
          <Button variant="outline" onClick={onCancel}>{t('rewind.cancel')}</Button>
          <Button variant="primary" onClick={() => { onConfirm(revertFiles) }}>{t('rewind.confirm')}</Button>
        </>
      )}
    >
      <p className={css.description}>{t('rewind.description')}</p>
      <label className={css.checkboxRow}>
        <input type="checkbox" checked={revertFiles} onChange={(event) => { setRevertFiles(event.currentTarget.checked) }} />
        <span>{t('rewind.revertFiles')}</span>
      </label>
    </Modal>
  )
}
