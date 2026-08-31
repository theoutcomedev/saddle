/**
 * Connect dialog: walks one authorization attempt against the host. The host
 * owns the attempt; this dialog polls its walkable state and renders whatever
 * it is waiting on — a notice (open this page, enter this code), a prompt
 * (typed or masked), or the settled outcome — and feeds answers back. Local
 * component state is the only state the dialog owns.
 */

import { useEffect, useState } from 'react'
import type { IConnections } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  ConnectionAttemptState, ConnectionFlowView,
} from '@deepseek-ai/dsh-api-remotes/client'
import { Button, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ConnectionsKey } from './locales.ts'
import css from './ConnectDialog.module.css'

/** How long the dialog waits between polls of the attempt state. */
const POLL_INTERVAL_MS = 700

/** Props bound by the section. */
export interface ConnectDialogProps {
  /** Whether the dialog is showing. */
  open: boolean
  /** The flow being connected. */
  flow: ConnectionFlowView | undefined
  /** The connections service face (injected by the section). */
  connections: IConnections
  /** Section copy. */
  t: (key: ConnectionsKey) => string
  /** Close the dialog (attempt keeps running unless cancelled). */
  onClose: () => void
  /** A connection was committed; the section refreshes its list. */
  onConnected: () => void
}

/** Walk one attempt to completion; the caller owns closing. */
export function ConnectDialog({ open, flow, connections, t, onClose, onConnected }: ConnectDialogProps) {
  const [method, setMethod] = useState<string | undefined>(undefined)
  const [attemptId, setAttemptId] = useState<string | undefined>(undefined)
  const [state, setState] = useState<ConnectionAttemptState | undefined>(undefined)
  const [value, setValue] = useState('')
  const [starting, setStarting] = useState(false)

  // Start fresh for every opened flow.
  useEffect(() => {
    if (!open) return
    setMethod(undefined)
    setAttemptId(undefined)
    setState(undefined)
    setValue('')
    setStarting(false)
  }, [open, flow?.key])

  // Poll the attempt until it settles.
  useEffect(() => {
    if (attemptId === undefined) return
    let cancelled = false
    const tick = async (): Promise<void> => {
      const result = await connections.poll(attemptId)
      if (cancelled) return
      if (!result.ok) return
      setState(result.value)
    }
    void tick()
    const timer = setInterval(() => { void tick() }, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [attemptId, connections])

  if (!open || flow === undefined) return null
  const settled = state?.state === 'settled'
  const failed = state?.state === 'failed'

  const begin = async (): Promise<void> => {
    if (starting) return
    setStarting(true)
    const result = await connections.connect(flow.key, method === undefined ? flow.methods[0]?.id : method)
    setStarting(false)
    if (!result.ok) {
      setState({ state: 'failed', message: result.error.message })
      return
    }
    setAttemptId(result.value.attemptId)
  }

  const submitAnswer = async (): Promise<void> => {
    if (attemptId === undefined || state?.state !== 'prompt') return
    const result = await connections.answer(attemptId, value)
    if (!result.ok) {
      setState({ state: 'failed', message: result.error.message })
      return
    }
    setValue('')
  }

  const cancelAttempt = (): void => {
    if (attemptId !== undefined) void connections.cancel(attemptId)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={cancelAttempt}
      title={t('attempt').replace('{label}', flow.label)}
      closeLabel={t('close')}
      footer={(
        <div className={css.footer}>
          <Button variant="ghost" onClick={cancelAttempt}>{t('cancel')}</Button>
          {state?.state === 'prompt' && (
            <Button variant="primary" disabled={value.trim() === ''} onClick={() => { void submitAnswer() }}>
              {t('answer')}
            </Button>
          )}
        </div>
      )}
    >
      <div className={css.body}>
        {attemptId === undefined && (
          <>
            {flow.methods.length > 1 && (
              <div className={css.step}>
                <p className={css.label}>{t('chooseMethod')}</p>
                <div className={css.methods} role="radiogroup" aria-label={t('method')}>
                  {flow.methods.map(entry => (
                    <button
                      key={entry.id}
                      type="button"
                      role="radio"
                      aria-checked={method === entry.id}
                      className={css.method}
                      onClick={() => { setMethod(entry.id) }}
                    >
                      {entry.id === 'api-key' ? t('methodApiKey')
                        : entry.id === 'device' ? t('methodDevice')
                          : t('methodOauth')}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className={css.step}>
              <Button
                variant="primary"
                disabled={starting}
                onClick={() => { void begin() }}
              >
                {starting ? t('connecting') : t('connect')}
              </Button>
            </div>
          </>
        )}

        {attemptId !== undefined && state?.state === 'connecting' && (
          <p className={css.waiting}>{t('connecting')}</p>
        )}

        {attemptId !== undefined && state?.state === 'notice' && (
          <div className={css.step}>
            <p className={css.noticeText}>{state.notice.message}</p>
            {state.notice.url !== undefined && (
              <a className={css.link} href={state.notice.url} target="_blank" rel="noreferrer">
                {t('openPage')}
              </a>
            )}
            {state.notice.code !== undefined && (
              <code className={css.code}>{state.notice.code}</code>
            )}
            <p className={css.waiting}>{t('waiting')}</p>
          </div>
        )}

        {attemptId !== undefined && state?.state === 'prompt' && (
          <div className={css.step}>
            <p className={css.noticeText}>{state.prompt.message}</p>
            {flow.docsUrl !== undefined && (
              <a className={css.link} href={flow.docsUrl} target='_blank' rel='noreferrer'>
                {t('docs')}: {t('openPage')}
              </a>
            )}
            {state.prompt.kind === 'select' ? (
              <select
                className={css.select}
                value={value}
                onChange={(event) => { setValue(event.target.value) }}
                onBlur={(event) => { setValue(event.currentTarget.value) }}
              >
                <option value="" disabled>{t('textPlaceholder')}</option>
                {state.prompt.options?.map(option => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            ) : (
              <Input
                type={state.prompt.kind === 'secret' ? 'password' : 'text'}
                placeholder={state.prompt.kind === 'secret' ? t('secretPlaceholder') : t('textPlaceholder')}
                value={value}
                autoFocus
                onChange={(event) => { setValue(event.target.value) }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && value.trim() !== '') void submitAnswer()
                }}
              />
            )}
          </div>
        )}

        {settled && state.status === 'authorized' && (
          <p className={css.success}>{t('authorized').replace('{label}', flow.label)}</p>
        )}
        {settled && state.status === 'cancelled' && (
          <p className={css.waiting}>{t('cancelled')}</p>
        )}
        {failed && (
          <p className={css.error}>{t('connectFailed').replace('{message}', state.message)}</p>
        )}

        {settled && (
          <div className={css.step}>
            <Button variant="primary" onClick={onConnected}>{t('close')}</Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
