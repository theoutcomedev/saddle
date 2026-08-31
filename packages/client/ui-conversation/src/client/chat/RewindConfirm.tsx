import { useEffect, useState } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ChatViewSlotProps } from '../contract/slots.ts'
import css from './RewindConfirm.module.css'

export interface RewindCollision {
  readonly sessionId: SessionId
  readonly files: readonly string[]
}

export interface RewindConfirmProps {
  open: boolean
  /** The anchor message seq (undefined while no request is pending). */
  seq: number | undefined
  onCancel: () => void
  onConfirm: (revertFiles: boolean) => void
  /** Read-only preflight listing other sessions that mutated files this rewind would restore. */
  checkCollisions: (seq: number) => Promise<RewindCollision[]>
  /** Resolve one other session's display title (falls back to the id). */
  titleOf: (sessionId: SessionId) => string
  t: ChatViewSlotProps['t']
}

/**
 * Rewind confirmation: reverts the conversation to the anchor message by
 * forking a continuation (the source stays in the list, so the rewind is
 * regret-safe) and optionally restores every file the agent mutated after
 * that point back to its before-state. When file revert is checked, a
 * read-only preflight lists other sessions that changed the same files, so
 * the user sees what would be overwritten before confirming.
 */
export function RewindConfirm({ open, seq, onCancel, onConfirm, checkCollisions, titleOf, t }: RewindConfirmProps) {
  const [revertFiles, setRevertFiles] = useState(false)
  const [collisions, setCollisions] = useState<RewindCollision[] | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkFailed, setCheckFailed] = useState(false)

  useEffect(() => {
    if (!open) {
      setRevertFiles(false)
      setCollisions(null)
      setChecking(false)
      setCheckFailed(false)
      return
    }
    if (!revertFiles || seq === undefined) {
      setCollisions(null)
      setChecking(false)
      setCheckFailed(false)
      return
    }
    let alive = true
    setChecking(true)
    setCheckFailed(false)
    checkCollisions(seq).then(
      (result) => { if (alive) { setCollisions(result); setChecking(false) } },
      () => { if (alive) { setCheckFailed(true); setChecking(false) } },
    )
    return () => { alive = false }
  }, [open, revertFiles, seq, checkCollisions])

  const showWarning = collisions !== null && collisions.length > 0

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
      {checking && <p className={css.checking}>{t('rewind.checking')}</p>}
      {!checking && checkFailed && <p className={css.checking}>{t('rewind.checkFailed')}</p>}
      {!checking && showWarning && (
        <div className={css.collision}>
          <p className={css.collisionTitle}>{t('rewind.collisions')}</p>
          <ul className={css.collisionList}>
            {collisions.map(collision => (
              <li key={collision.sessionId} className={css.collisionRow}>
                <strong className={css.collisionSession}>{titleOf(collision.sessionId)}</strong>
                <code className={css.collisionFiles}>{collision.files.join(', ')}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}
