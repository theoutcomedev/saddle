/**
 * Workbench browser/preview pane: a URL bar plus an embedded webview. Any URL
 * can be navigated here, so a URL surfaced anywhere can be opened in this pane
 * without leaving the app. The iframe shows sites that permit framing; a site
 * sending X-Frame-Options / CSP frame-ancestors refuses to render (a real
 * embedded browser is deferred).
 */

import { useEffect, useState, type FormEvent } from 'react'
import { IconSendOutline16, IconLinkOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { NS } from './locales.ts'
import type {} from './contract/slots.ts'
import css from './browser-pane.module.css'

/** Full browser-pane props: the owner params (an initial URL) + locale seat. */
export type BrowserPaneProps = PropsRuntime<'workbench.pane.browser'> & PropsLocale<typeof NS>

/** Normalise an address to an http(s) URL, or null when it is not navigable. */
function toHref(raw: string): string | null {
  const value = raw.trim()
  if (value === '') return null
  if (/^https?:\/\//i.test(value)) return value
  if (value.includes(' ')) return null
  return `https://${value}`
}

/** Render the browser pane. */
export function BrowserPane({ params, t }: BrowserPaneProps) {
  const initialUrl = typeof params?.url === 'string' ? params.url : ''
  const initialStream = typeof params?.streamUrl === 'string' ? params.streamUrl : null
  const [value, setValue] = useState(initialUrl || initialStream || '')
  const [href, setHref] = useState<string | null>(initialStream ?? (initialUrl === '' ? null : toHref(initialUrl)))
  const [error, setError] = useState(false)

  // Follow a new owner-supplied URL or streamUrl without remounting.
  useEffect(() => {
    if (typeof params?.streamUrl === 'string') {
      setValue(typeof params?.url === 'string' ? params.url : params.streamUrl)
      setHref(params.streamUrl)
      setError(false)
    } else if (typeof params?.url === 'string') {
      const next = toHref(params.url)
      setValue(params.url)
      setHref(next)
      setError(false)
    }
  }, [params?.url, params?.streamUrl])

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    const next = toHref(value)
    if (next === null) { setError(true); return }
    setError(false)
    setHref(next)
  }

  return (
    <div className={css.root}>
      <form className={css.bar} onSubmit={submit} role="search">
        <input
          className={css.url}
          type="text"
          value={value}
          placeholder={t('workbench.browser.url')}
          aria-label={t('workbench.browser.url')}
          onChange={(event) => { setValue(event.target.value); setError(false) }}
        />
        <button type="submit" className={css.go} aria-label={t('workbench.browser.go')}>
          <IconSendOutline16 size={14} />
        </button>
        <button
          type="button"
          className={css.open}
          aria-label={t('workbench.browser.open')}
          title={t('workbench.browser.open')}
          disabled={href === null && value === ''}
          onClick={() => {
            const target = (value ? toHref(value) : null) ?? href
            if (target !== null) window.open(target, '_blank', 'noopener')
          }}
        >
          <IconLinkOutline16 size={14} />
        </button>
      </form>
      <div className={css.frameWrap}>
        {href === null
          ? <div className={css.blank}>{t('workbench.browser.blank')}</div>
          : <iframe className={css.frame} title={value || href} src={href} sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups" />}
      </div>
      {error && <div className={css.error}>Invalid URL</div>}
    </div>
  )
}
