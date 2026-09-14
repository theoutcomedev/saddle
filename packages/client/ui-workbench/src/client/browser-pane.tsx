import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  IconSendOutline16,
  IconLinkOutline16,
  IconChevronLeftOutline14,
  IconChevronRightOutline14,
  IconRefreshOutline14,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { NS } from './locales.ts'
import { useSubrowHost } from './use-subrow-host.ts'
import type {} from './contract/slots.ts'
import css from './browser-pane.module.css'

/** Full browser-pane props: the owner params (an initial URL) + locale seat. */
export type BrowserPaneProps = PropsRuntime<'workbench.pane.browser'> & PropsLocale<typeof NS>

interface BrowserTab {
  id: string
  title: string
  url: string
}

/** Crisp fullscreen expand icon */
function IconFullscreen({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M1.5 5.5V3.5C1.5 2.4 2.4 1.5 3.5 1.5H5.5M10.5 1.5H12.5C13.6 1.5 14.5 2.4 14.5 3.5V5.5M14.5 10.5V12.5C14.5 13.6 13.6 14.5 12.5 14.5H10.5M5.5 14.5H3.5C2.4 14.5 1.5 13.6 1.5 12.5V10.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Crisp minimize / restore icon */
function IconMinimize({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M5.5 1.5V3.5C5.5 4.6 4.6 5.5 3.5 5.5H1.5M10.5 5.5H12.5C11.4 5.5 10.5 4.6 10.5 3.5V1.5M14.5 10.5H12.5C11.4 10.5 10.5 11.4 10.5 12.5V14.5M1.5 10.5H3.5C4.6 10.5 5.5 11.4 5.5 12.5V14.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Normalise an address to an http(s) URL, or null when it is not navigable. */
function toHref(raw: string): string | null {
  const value = raw.trim()
  if (value === '') return null
  if (/^https?:\/\//i.test(value)) return value
  if (value.includes(' ')) return null
  return `https://${value}`
}

/** Derive a concise tab label from a URL. */
function getTabTitle(url: string): string {
  if (!url) return 'New Tab'
  try {
    const host = new URL(url).hostname
    return host.replace(/^www\./, '') || 'Tab'
  } catch {
    return url.slice(0, 16) || 'Tab'
  }
}

/** Render the browser pane: native controls plus multi-tabs in the sub-row. */
export function BrowserPane({ params, t }: BrowserPaneProps) {
  const initialUrl = typeof params?.url === 'string' ? params.url : ''

  const initialTab: BrowserTab = {
    id: 'tab-1',
    title: getTabTitle(initialUrl),
    url: initialUrl,
  }

  const [tabs, setTabs] = useState<BrowserTab[]>([initialTab])
  const [activeTabId, setActiveTabId] = useState<string>('tab-1')

  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0] ?? initialTab
  const [value, setValue] = useState(() => activeTab.url)
  const [rawTargetUrl, setRawTargetUrl] = useState<string | null>(activeTab.url || null)
  const [error, setError] = useState(false)
  const [isFrameBlocked, setIsFrameBlocked] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  // Workbench header row 2, tracked live: it can mount after this pane and is
  // replaced whenever the header remounts.
  const subrowEl = useSubrowHost()

  useEffect(() => {
    if (!isMaximized) return
    document.body.setAttribute('data-browser-maximized', 'true')

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMaximized(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.removeAttribute('data-browser-maximized')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isMaximized])

  useEffect(() => {
    return () => {
      document.body.removeAttribute('data-browser-maximized')
    }
  }, [])

  // Follow a new owner-supplied URL without remounting.
  useEffect(() => {
    const nextUrl = typeof params?.url === 'string' ? params.url : ''
    if (!nextUrl) return

    setTabs((prev) => {
      const current = prev.find(t => t.id === activeTabId)
      if (current && current.url !== nextUrl) {
        return prev.map(t => t.id === activeTabId ? {
          ...t,
          title: getTabTitle(nextUrl),
          url: nextUrl,
        } : t)
      }
      return prev
    })

    setRawTargetUrl(nextUrl)
    setValue(nextUrl)
    setError(false)
    setIsFrameBlocked(false)
  }, [params?.url, activeTabId])

  // Switch tabs
  const handleSelectTab = (tab: BrowserTab) => {
    setActiveTabId(tab.id)
    setValue(tab.url)
    setRawTargetUrl(tab.url || null)
    setError(false)
    setIsFrameBlocked(false)
  }

  // Create new tab
  const handleAddTab = () => {
    const newId = `tab-${Date.now()}`
    const newTab: BrowserTab = {
      id: newId,
      title: 'New Tab',
      url: '',
    }
    setTabs(prev => [...prev, newTab])
    setActiveTabId(newId)
    setValue('')
    setRawTargetUrl(null)
    setError(false)
    setIsFrameBlocked(false)
  }

  // Close tab
  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (tabs.length <= 1) {
      // Don't close last tab, just reset it
      setTabs([{ id: 'tab-1', title: 'New Tab', url: '' }])
      setActiveTabId('tab-1')
      setValue('')
      setRawTargetUrl(null)
      setError(false)
      setIsFrameBlocked(false)
      return
    }

    const nextTabs = tabs.filter(t => t.id !== id)
    setTabs(nextTabs)
    if (activeTabId === id && nextTabs.length > 0) {
      const nextActive = nextTabs[nextTabs.length - 1]
      if (nextActive) handleSelectTab(nextActive)
    }
  }

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    const next = toHref(value)
    if (next === null) {
      setError(true)
      return
    }
    setError(false)
    setIsFrameBlocked(false)
    setRawTargetUrl(next)

    // Update active tab title & url
    setTabs(prev => prev.map(t => t.id === activeTabId ? {
      ...t,
      title: getTabTitle(next),
      url: next,
    } : t))
  }

  // The address bar is the single navigation source for this pane.
  const activeSrc = rawTargetUrl ? toHref(rawTargetUrl) : null

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
    setIsFrameBlocked(false)
    if (iframeRef.current) {
      const current = iframeRef.current.src
      iframeRef.current.src = current
    }
  }

  // Sub-row tabs UI
  const subrowContent = (
    <div className={css.subrowTabs}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          className={`${css.tabChip} ${tab.id === activeTabId ? css.tabChipActive : ''}`}
          onClick={() => handleSelectTab(tab)}
          title={tab.url || tab.title}
        >
          <span className={css.tabTitle}>{tab.title}</span>
          <span
            className={css.tabClose}
            onClick={e => handleCloseTab(tab.id, e)}
            role="button"
            title={t('workbench.tabs.close')}
          >
            ×
          </span>
        </button>
      ))}
      <button
        type="button"
        className={css.newTabBtn}
        onClick={handleAddTab}
        title={t('workbench.browser.newTab')}
        aria-label={t('workbench.browser.newTab')}
      >
        +
      </button>
    </div>
  )

  return (
    <div className={`${css.root} ${isMaximized ? css.browserMaximized : ''}`}>
      {!isMaximized && subrowEl ? createPortal(subrowContent, subrowEl) : null}

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

        <button
          type="button"
          className={css.open}
          aria-label={isMaximized ? 'Restore View' : 'Maximize View'}
          title={isMaximized ? 'Restore View (Esc)' : 'Maximize View'}
          onClick={() => setIsMaximized(!isMaximized)}
        >
          {isMaximized ? <IconMinimize size={14} /> : <IconFullscreen size={14} />}
        </button>

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
        ) : isFrameBlocked ? (
          <div className={css.blockedCard}>
            <div className={css.blockedIcon}>🛡️</div>
            <h3 className={css.blockedTitle}>{t('workbench.browser.frameBlockedTitle')}</h3>
            <p className={css.blockedDesc}>{t('workbench.browser.frameBlockedDesc')}</p>
            <div className={css.blockedActions}>
              <button
                type="button"
                className={css.blockedBtn}
                onClick={() => {
                  const target = (value ? toHref(value) : null) ?? activeSrc
                  if (target) window.open(target, '_blank', 'noopener')
                }}
              >
                {t('workbench.browser.openNewTab')}
              </button>
              <button
                type="button"
                className={`${css.blockedBtn} ${css.blockedBtnSec}`}
                onClick={() => setIsFrameBlocked(false)}
              >
                {t('workbench.browser.reload')}
              </button>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            key={activeSrc}
            className={css.frame}
            title={value || activeSrc}
            src={activeSrc}
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"
            onError={() => setIsFrameBlocked(true)}
          />
        )}
      </div>
      {error && <div className={css.error}>Invalid URL</div>}
    </div>
  )
}
