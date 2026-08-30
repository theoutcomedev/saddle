/**
 * "Apps" storefront components: the full-screen apps catalog and the
 * full-screen autosaving notepad.
 */

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Button, IconCloseOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-host-app-store/remote'
import css from './app-store.module.css'

/** One installable app in the storefront catalog. */
export interface AppCatalogEntry {
  readonly id: string
  readonly name: string
  readonly category: string
  readonly icon: string
  readonly tags: readonly string[]
  readonly description: string
}

/** Structural face of the `remote.appStore` contribution. */
export interface AppStoreRemote {
  load: () => Promise<{ ok: boolean; value?: { content: string } }>
  save: (content: string) => Promise<{ ok: boolean }>
}

/** The storefront catalog; add an entry + a renderer to ship a new app. */
const APP_CATALOG: readonly AppCatalogEntry[] = [
  {
    id: 'notepad',
    name: 'Notepad',
    category: 'Notes',
    icon: '📝',
    tags: ['notes', 'autosave'],
    description: 'A full-screen notepad that autosaves. I can read what you type.',
  },
]

function AppIcon({ size = 16, className }: { size?: number; className: string | undefined }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="2" width="4.8" height="4.8" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9.2" y="2" width="4.8" height="4.8" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2" y="9.2" width="4.8" height="4.8" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9.2" y="9.2" width="4.8" height="4.8" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function NotepadApp({ appStore, onClose }: { appStore: AppStoreRemote; onClose: () => void }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    let alive = true
    void appStore.load().then((res) => {
      if (!alive) return
      if (res.ok && res.value) setText(res.value.content)
      else setStatus('Load failed')
    }).catch(() => {
      if (alive) setStatus('Load failed')
    })
    return () => {
      alive = false
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [appStore])

  const persist = (value: string, done: string) => {
    void appStore.save(value).then((res) => {
      setStatus(res.ok ? done : 'Save failed')
    }).catch(() => {
      setStatus('Save failed')
    })
  }

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value
    setText(value)
    setStatus('Unsaved…')
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => persist(value, 'Autosaved'), 1200)
  }

  const save = () => persist(text, 'Saved')

  const handleClose = () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    void appStore.save(text)
    onClose()
  }

  return (
    <div className={css.npRoot}>
      <div className={css.npHeader}>
        <h2 className={css.npTitle}>Notepad</h2>
        <div className={css.npActions}>
          <span className={css.npStatus}>{status}</span>
          <Button variant="primary" size="sm" onClick={save}>Save</Button>
          <Button variant="outline" size="sm" icon={<IconCloseOutline16 size={12} />} onClick={handleClose}>Close</Button>
        </div>
      </div>
      <textarea
        className={css.npTa}
        value={text}
        autoFocus
        placeholder="Type here — I can read what you write. It autosaves as you go."
        onChange={onChange}
      />
    </div>
  )
}

function AppStoreModal({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')

  const categories = ['All']
  const seen = new Set<string>()
  for (const app of APP_CATALOG) {
    if (!seen.has(app.category)) {
      seen.add(app.category)
      categories.push(app.category)
    }
  }
  categories.sort((a, b) => (a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b)))

  const q = query.trim().toLowerCase()
  const filtered = APP_CATALOG.filter((app) => {
    if (category !== 'All' && app.category !== category) return false
    if (q) {
      const hay = [app.name, app.description, app.category, ...app.tags].join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  return (
    <div className={css.mask} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={css.panel} role="dialog" aria-modal="true" aria-labelledby="my-apps-title">
        <div className={css.header}>
          <div className={css.titleArea}>
            <h2 id="my-apps-title" className={css.title}>Apps</h2>
            <span className={css.count}>{APP_CATALOG.length} {APP_CATALOG.length === 1 ? 'app' : 'apps'}</span>
          </div>
          <button type="button" className={css.close} aria-label="Close" onClick={onClose}>
            <IconCloseOutline16 size={14} />
          </button>
        </div>
        <div className={css.toolbar}>
          <input
            type="search"
            className={css.search}
            placeholder="Search apps…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className={css.categories}>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              className={`${css.chip}${category === cat ? ` ${css.chipActive}` : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className={css.body}>
          {filtered.length === 0 ? (
            <div className={css.empty}>No apps match your search.</div>
          ) : (
            <div className={css.grid}>
              {filtered.map(app => (
                <div key={app.id} className={css.card}>
                  <div className={css.cardHead}>
                    <div className={css.cardIcon}>{app.icon || '📦'}</div>
                    <div className={css.cardTitle}>
                      <div className={css.cardName}>{app.name}</div>
                      <div className={css.cardCat}>{app.category}</div>
                    </div>
                  </div>
                  <div className={css.cardDesc}>{app.description}</div>
                  <div className={css.cardTags}>
                    {app.tags.map(tag => (
                      <span key={tag} className={css.tag}>{tag}</span>
                    ))}
                  </div>
                  <div className={css.cardFoot}>
                    <Button variant="primary" size="sm" onClick={() => onOpen(app.id)}>Open</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function AppsEntry({ wide = true, appStore }: { wide?: boolean; appStore: AppStoreRemote }) {
  const [open, setOpen] = useState(false)
  const [activeApp, setActiveApp] = useState<string | null>(null)

  const closeAll = () => { setActiveApp(null); setOpen(false) }

  const renderActiveApp = (id: string) => {
    switch (id) {
      case 'notepad': return <NotepadApp appStore={appStore} onClose={closeAll} />
      default: return null
    }
  }

  return (
    <>
      <button
        type="button"
        className={wide ? css.appBtn : `${css.appBtn} ${css.appBtnCollapsed}`}
        aria-label="Apps"
        title={wide ? undefined : 'Apps'}
        onClick={() => setOpen(true)}
      >
        <AppIcon size={16} className={css.appBtnIcon} />
        {wide && <span className={css.appBtnLabel}>Apps</span>}
      </button>
      {open && (activeApp === null
        ? <AppStoreModal onClose={closeAll} onOpen={setActiveApp} />
        : renderActiveApp(activeApp))}
    </>
  )
}
