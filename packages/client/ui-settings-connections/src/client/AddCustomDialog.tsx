/**
 * Add-custom-service dialog: the operator names a paste-in API-key service, an
 * optional docs page, and the credential field(s) the connect flow should ask
 * for. The host persists the definition and registers its flow immediately.
 */
import { useEffect, useState } from 'react'
import type { IConnections } from '@deepseek-ai/dsh-client-runtime/client'
import { Button, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ConnectionsKey } from './locales.ts'
import css from './ConnectDialog.module.css'

/** Props bound by the section. */
export interface AddCustomDialogProps {
  open: boolean
  connections: IConnections
  t: (key: ConnectionsKey) => string
  onClose: () => void
  onAdded: () => void
}

/** A field row being edited. */
interface FieldRow {
  label: string
}

/** Form state, reset on open. */
interface FormState {
  name: string
  docsUrl: string
  fields: FieldRow[]
}

const EMPTY: FormState = { name: '', docsUrl: '', fields: [{ label: '' }] }

/** Add a custom service. */
export function AddCustomDialog({ open, connections, t, onClose, onAdded }: AddCustomDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) { setForm(EMPTY); setError('') }
  }, [open])

  const valid = form.name.trim() !== ''

  const submit = async (): Promise<void> => {
    if (!valid || submitting) return
    setSubmitting(true)
    setError('')
    const fields = form.fields
      .map(field => field.label.trim())
      .filter(label => label !== '')
      .map(label => ({ label }))
    const result = await connections.registerCustom({
      label: form.name,
      ...form.docsUrl.trim() === '' ? {} : { docsUrl: form.docsUrl.trim() },
      ...fields.length === 0 ? {} : { fields },
    })
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    onAdded()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('addCustomTitle')}
      closeLabel={t('close')}
      footer={(
        <div className={css.footer}>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" disabled={!valid || submitting} onClick={() => { void submit() }}>
            {submitting ? t('creating') : t('connect')}
          </Button>
        </div>
      )}
    >
      <div className={css.body}>
        <p className={css.noticeText}>{t('addCustomIntro')}</p>
        <div className={css.step}>
          <label className={css.label} htmlFor="custom-name">{t('name')}</label>
          <Input
            id="custom-name"
            value={form.name}
            placeholder={t('namePlaceholder')}
            autoFocus
            onChange={(event) => { setForm({ ...form, name: event.target.value }) }}
          />
        </div>
        <div className={css.step}>
          <label className={css.label} htmlFor="custom-docs">{t('docs')}</label>
          <Input
            id="custom-docs"
            value={form.docsUrl}
            placeholder={t('docsUrlPlaceholder')}
            onChange={(event) => { setForm({ ...form, docsUrl: event.target.value }) }}
          />
        </div>
        <div className={css.step}>
          <span className={css.label}>{t('fieldsLabel')}</span>
          {form.fields.map((field, index) => (
            <Input
              key={index}
              value={field.label}
              placeholder={t('fieldPlaceholder')}
              onChange={(event) => {
                const next = [...form.fields]
                next[index] = { label: event.target.value }
                setForm({ ...form, fields: next })
              }}
            />
          ))}
          <Button variant="outline" size="sm" onClick={() => { setForm({ ...form, fields: [...form.fields, { label: '' }] }) }}>
            {t('addField')}
          </Button>
        </div>
        {error !== '' && <p className={css.error}>{error}</p>}
      </div>
    </Modal>
  )
}
