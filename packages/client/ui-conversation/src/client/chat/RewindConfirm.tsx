import { useEffect, useState } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { RewindCollisionsResult, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ChatViewSlotProps } from '../contract/slots.ts'
import css from './RewindConfirm.module.css'

export interface RewindCollision {
  readonly sessionId: SessionId
  readonly files: readonly string[]
}

export interface RevertedFileSummary {
  readonly path: string
  readonly additions: number
  readonly deletions: number
}

export interface RewindConfirmProps {
  open: boolean
  /** The anchor message seq (undefined while no request is pending). */
  seq: number | undefined
  onCancel: () => void
  onConfirm: (revertFiles: boolean) => void
  /** Read-only preflight listing other sessions that mutated files and affected files this rewind would restore. */
  checkCollisions: (seq: number) => Promise<RewindCollisionsResult | RewindCollision[]>
  /** Resolve one other session's display title (falls back to the id). */
  titleOf: (sessionId: SessionId) => string
  t: ChatViewSlotProps['t']
}

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'mjs':
      return '📄'
    case 'json':
    case 'yaml':
    case 'yml':
    case 'toml':
      return '⚙️'
    case 'md':
    case 'txt':
    case 'log':
      return '📝'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return '🖼️'
    case 'html':
    case 'htm':
    case 'css':
      return '🌐'
    case 'py':
    case 'sh':
    case 'bash':
      return '⚡'
    case 'sql':
    case 'db':
      return '🗄️'
    default:
      return '📄'
  }
}

/**
 * Rewind confirmation: reverts the conversation to the anchor message by
 * forking a continuation (the source stays in the list, so the rewind is
 * regret-safe) and optionally restores every file the agent mutated after
 * that point back to its before-state. When file revert is checked, a
 * read-only preflight lists other sessions that changed the same files, so
 * the user sees what would be overwritten before confirming, and displays
 * the full list of files with their additions/deletions diff.
 */
export function RewindConfirm({ open, seq, onCancel, onConfirm, checkCollisions, titleOf, t }: RewindConfirmProps) {
  const [revertFiles, setRevertFiles] = useState(true)
  const [collisions, setCollisions] = useState<RewindCollision[] | null>(null)
  const [revertedFiles, setRevertedFiles] = useState<RevertedFileSummary[] | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkFailed, setCheckFailed] = useState(false)

  useEffect(() => {
    if (!open) {
      setRevertFiles(true)
      setCollisions(null)
      setRevertedFiles(null)
      setChecking(false)
      setCheckFailed(false)
      return
    }
    if (!revertFiles || seq === undefined) {
      setCollisions(null)
      setRevertedFiles(null)
      setChecking(false)
      setCheckFailed(false)
      return
    }
    let alive = true
    setChecking(true)
    setCheckFailed(false)
    checkCollisions(seq).then(
      (result) => {
        if (!alive) return
        if (Array.isArray(result)) {
          setCollisions(result)
          setRevertedFiles([])
        } else {
          setCollisions([...result.collisions])
          setRevertedFiles(result.revertedFiles ? [...result.revertedFiles] : [])
        }
        setChecking(false)
      },
      () => {
        if (alive) {
          setCheckFailed(true)
          setChecking(false)
        }
      },
    )
    return () => { alive = false }
  }, [open, revertFiles, seq, checkCollisions])

  const showWarning = collisions !== null && collisions.length > 0
  const showFiles = revertFiles && revertedFiles !== null && revertedFiles.length > 0

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

      {!checking && showFiles && (
        <div className={css.filesSection}>
          <p className={css.filesSectionTitle}>{t('rewind.affectedFiles')}</p>
          <div className={css.fileList}>
            {revertedFiles.map(file => (
              <div key={file.path} className={css.fileRow}>
                <span className={css.fileIcon}>{fileIcon(file.path)}</span>
                <span className={css.filePath} title={file.path}>{file.path}</span>
                <div className={css.fileStats}>
                  {file.additions > 0 && (
                    <span className={css.additions}>+{file.additions}</span>
                  )}
                  {file.deletions > 0 && (
                    <span className={css.deletions}>-{file.deletions}</span>
                  )}
                  {file.additions === 0 && file.deletions === 0 && (
                    <span className={css.neutralDiff}>0</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
