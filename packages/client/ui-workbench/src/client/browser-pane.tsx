import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  IconSendOutline16,
  IconLinkOutline16,
  IconChevronLeftOutline14,
  IconChevronRightOutline14,
  IconRefreshOutline14,
} from '@deepseek-ai/dsh-client-ui-primitives'
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

/** Check if a URL represents a Steel session stream or debugger endpoint. */
function isSteelStreamUrl(url: string): boolean {
  return url.includes('/v1/sessions/') && (url.includes('/debug') || url.includes('/viewer'))
}

/** Extract clean target URL if stored or embedded in params or stream query. */
function resolveDisplayUrl(url?: string, streamUrl?: string): string {
  if (url && !isSteelStreamUrl(url)) return url
  if (streamUrl) {
    try {
      const parsed = new URL(streamUrl)
      const inner = parsed.searchParams.get('url')
      if (inner) return inner
    } catch {}
  }
  return url || streamUrl || ''
}

/** Construct optimal streaming iframe src with theme and interactivity. */
function buildStreamIframeSrc(streamUrl: string, interactive: boolean, theme: string): string {
  try {
    const url = new URL(streamUrl)
    url.searchParams.set('showControls', 'false')
    url.searchParams.set('interactive', interactive ? 'true' : 'false')
    url.searchParams.set('theme', theme === 'dark' ? 'dark' : 'light')
    return url.toString()
  } catch {
    const sep = streamUrl.includes('?') ? '&' : '?'
    return `${streamUrl}${sep}showControls=false&interactive=${interactive}&theme=${theme}`
  }
}

/** Render the browser pane with native controls and live stream takeover. */
export function BrowserPane({ params, t }: BrowserPaneProps) {
  const initialUrl = typeof params?.url === 'string' ? params.url : ''
  const initialStream = typeof params?.streamUrl === 'string' ? params.streamUrl : null

  const [value, setValue] = useState(() => resolveDisplayUrl(initialUrl, initialStream ?? undefined))
  const [streamEndpoint, setStreamEndpoint] = useState<string | null>(initialStream)
  const [rawTargetUrl, setRawTargetUrl] = useState<string | null>(initialUrl || null)
  const [interactive, setInteractive] = useState(true)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [error, setError] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  // Track system theme changes for stream background matching
  useEffect(() => {
    const detectTheme = () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
        || document.documentElement.classList.contains('dark')
      setTheme(isDark ? 'dark' : 'light')
    }
    detectTheme()
    const observer = new MutationObserver(detectTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    return () => observer.disconnect()
  }, [])

  // Follow a new owner-supplied URL or streamUrl without remounting.
  useEffect(() => {
    if (typeof params?.streamUrl === 'string') {
      setStreamEndpoint(params.streamUrl)
      if (typeof params?.url === 'string' && params.url) {
        setRawTargetUrl(params.url)
        setValue(params.url)
      } else {
        setValue(resolveDisplayUrl(undefined, params.streamUrl))
      }
      setError(false)
    } else if (typeof params?.url === 'string') {
      setRawTargetUrl(params.url)
      setValue(params.url)
      if (isSteelStreamUrl(params.url)) {
        setStreamEndpoint(params.url)
      } else {
        setStreamEndpoint(null)
      }
      setError(false)
    }
  }, [params?.url, params?.streamUrl])

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    const next = toHref(value)
    if (next === null) {
      setError(true)
      return
    }
    setError(false)
    setRawTargetUrl(next)
    if (streamEndpoint) {
      // If we have an active stream, notify Steel session via custom event or navigate
      window.dispatchEvent(new CustomEvent('workbench:open-browser', {
        detail: { url: next, streamUrl: streamEndpoint },
      }))
    }
  }

  // Calculate actual iframe src
  const activeSrc = streamEndpoint
    ? buildStreamIframeSrc(streamEndpoint, interactive, theme)
    : (rawTargetUrl ? toHref(rawTargetUrl) : null)

  const handleBack = () => {
    try {
      iframeRef.current?.contentWindow?.history.back()
    } catch {}
  }

  const handleForward = () => {
    try {
      iframeRef.current?.contentWindow?.history.forward()
    } catch {}
  }

  const handleReload = () => {
    if (iframeRef.current) {
      const current = iframeRef.current.src
      iframeRef.current.src = current
    }
  }

  return (
    <div className={css.root}>
      <div className={css.bar}>
        <div className={css.navGroup}>
          <button
            type="button"
            className={css.navBtn}
            onClick={handleBack}
            title={t('workbench.browser.back')}
            aria-label={t('workbench.browser.back')}
          >
            <IconChevronLeftOutline14 size={14} />
          </button>
          <button
            type="button"
            className={css.navBtn}
            onClick={handleForward}
            title={t('workbench.browser.forward')}
            aria-label={t('workbench.browser.forward')}
          >
            <IconChevronRightOutline14 size={14} />
          </button>
          <button
            type="button"
            className={css.navBtn}
            onClick={handleReload}
            title={t('workbench.browser.reload')}
            aria-label={t('workbench.browser.reload')}
          >
            <IconRefreshOutline14 size={14} />
          </button>
        </div>

        <form className={css.urlForm} onSubmit={submit} role="search">
          <input
            className={css.url}
            type="text"
            value={value}
            placeholder={t('workbench.browser.url')}
            aria-label={t('workbench.browser.url')}
            onChange={(event) => {
              setValue(event.target.value)
              setError(false)
            }}
          />
          <button type="submit" className={css.go} aria-label={t('workbench.browser.go')}>
            <IconSendOutline16 size={14} />
          </button>
        </form>

        {streamEndpoint && (
          <button
            type="button"
            className={`${css.takeoverBtn} ${interactive ? css.takeoverActive : ''}`}
            onClick={() => setInteractive(!interactive)}
            title={interactive ? t('workbench.browser.takeover') : t('workbench.browser.viewOnly')}
          >
            <span className={css.takeoverDot} />
            <span className={css.takeoverLabel}>
              {interactive ? t('workbench.browser.takeover') : t('workbench.browser.viewOnly')}
            </span>
          </button>
        )}

        <button
          type="button"
          className={css.open}
          aria-label={t('workbench.browser.open')}
          title={t('workbench.browser.open')}
          disabled={activeSrc === null && value === ''}
          onClick={() => {
            const target = (value ? toHref(value) : null) ?? activeSrc
            if (target !== null) window.open(target, '_blank', 'noopener')
          }}
        >
          <IconLinkOutline16 size={14} />
        </button>
      </div>

      <div className={css.frameWrap}>
        {activeSrc === null ? (
          <div className={css.blank}>{t('workbench.browser.blank')}</div>
        ) : (
          <iframe
            ref={iframeRef}
            key={`${activeSrc}-${interactive}-${theme}`}
            className={css.frame}
            title={value || activeSrc}
            src={activeSrc}
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
          />
        )}
      </div>
      {error && <div className={css.error}>Invalid URL</div>}
    </div>
  )
}
