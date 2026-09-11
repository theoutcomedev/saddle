/**
 * "Apps" storefront components: the full-screen apps catalog and the
 * full-screen autosaving notepad.
 */

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { Button, IconCloseOutline16, IconListPenOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
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
    icon: 'notepad',
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

/** Crisp, pixel-perfect dock icon (split-pane with right half filled) */
function IconDock({ size = 14, className, style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8.5 1.5H12.5C13.6 1.5 14.5 2.4 14.5 3.5V12.5C14.5 13.6 13.6 14.5 12.5 14.5H8.5V1.5Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Crisp, pixel-perfect 4-corners fullscreen expand icon optically matched to IconDock */
function IconFullscreen({ size = 14, className, style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'block', flexShrink: 0, ...style }}
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

export function NotepadApp({
  appStore,
  mode = 'fullscreen',
  onClose,
  onFullscreen,
}: {
  appStore: AppStoreRemote
  mode?: 'fullscreen' | 'docked'
  onClose?: () => void
  onFullscreen?: () => void
}) {
  interface NoteItem {
    id: string
    title: string
    content: string
  }

  const [notes, setNotes] = useState<NoteItem[]>([
    { id: 'note-1', title: 'Note 1', content: '' },
  ])
  const [activeNoteId, setActiveNoteId] = useState<string>('note-1')
  const [status, setStatus] = useState('')
  const timerRef = useRef<number | null>(null)

  // Subrow element target (#workbench-strip-subrow)
  const [subrowEl, setSubrowEl] = useState<HTMLElement | null>(() => {
    return typeof document !== 'undefined' ? document.getElementById('workbench-strip-subrow') : null
  })

  useEffect(() => {
    if (!subrowEl && typeof document !== 'undefined') {
      const el = document.getElementById('workbench-strip-subrow')
      if (el) setSubrowEl(el)
    }
  }, [subrowEl])

  // Load initial content from appStore on mount
  useEffect(() => {
    let alive = true
    void appStore.load().then((res) => {
      if (!alive) return
      if (res.ok && res.value) {
        const content = res.value.content || ''
        // Try parsing JSON if stored as multi-note, else treat as single note content
        try {
          const parsed = JSON.parse(content)
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) {
            setNotes(parsed)
            setActiveNoteId(parsed[0].id)
            return
          }
        } catch {}
        setNotes([{ id: 'note-1', title: 'Note 1', content }])
        setActiveNoteId('note-1')
      } else {
        setStatus('Load failed')
      }
    }).catch(() => {
      if (alive) setStatus('Load failed')
    })
    return () => {
      alive = false
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [appStore])

  const activeNote = notes.find(n => n.id === activeNoteId) ?? notes[0] ?? { id: 'note-1', title: 'Note 1', content: '' }

  const persistNotes = (allNotes: NoteItem[], done: string) => {
    // If only 1 note and title is Note 1, save raw string for backward compatibility
    const first = allNotes[0]
    const payload = allNotes.length === 1 && first && first.id === 'note-1'
      ? first.content
      : JSON.stringify(allNotes)
    void appStore.save(payload).then((res) => {
      setStatus(res.ok ? done : 'Save failed')
    }).catch(() => {
      setStatus('Save failed')
    })
  }

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value
    const nextNotes = notes.map(n => n.id === activeNoteId ? { ...n, content: value } : n)
    setNotes(nextNotes)
    setStatus('Unsaved…')
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => persistNotes(nextNotes, 'Autosaved'), 1200)
  }

  const save = () => persistNotes(notes, 'Saved')

  const handleAddNote = () => {
    const nextNum = notes.length + 1
    const newId = `note-${Date.now()}`
    const newNote: NoteItem = {
      id: newId,
      title: `Note ${nextNum}`,
      content: '',
    }
    const nextNotes = [...notes, newNote]
    setNotes(nextNotes)
    setActiveNoteId(newId)
    persistNotes(nextNotes, 'Saved')
  }

  const handleCloseNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (notes.length <= 1) {
      const resetNotes = [{ id: 'note-1', title: 'Note 1', content: '' }]
      setNotes(resetNotes)
      setActiveNoteId('note-1')
      persistNotes(resetNotes, 'Saved')
      return
    }
    const nextNotes = notes.filter(n => n.id !== id)
    setNotes(nextNotes)
    if (activeNoteId === id && nextNotes.length > 0) {
      const last = nextNotes[nextNotes.length - 1]
      if (last) setActiveNoteId(last.id)
    }
    persistNotes(nextNotes, 'Saved')
  }

  const handleClose = () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    persistNotes(notes, 'Saved')
    onClose?.()
  }

  const handleDock = () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    persistNotes(notes, 'Saved')
    onClose?.()
    window.dispatchEvent(new CustomEvent('workbench:open-app', {
      detail: { appId: 'notepad', title: 'Notepad', icon: 'notepad' },
    }))
  }

  const handleFullscreen = () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    persistNotes(notes, 'Saved')
    window.dispatchEvent(new CustomEvent('workbench:close-details'))
    if (onFullscreen) {
      onFullscreen()
    } else {
      window.dispatchEvent(new CustomEvent('saddle:open-fullscreen-app', {
        detail: { appId: 'notepad' },
      }))
    }
  }

  const isDocked = mode === 'docked'

  const notesSubrowContent = (
    <div className={css.subrowTabs}>
      {notes.map(note => (
        <button
          key={note.id}
          type="button"
          className={`${css.tabChip} ${note.id === activeNoteId ? css.tabChipActive : ''}`}
          onClick={() => setActiveNoteId(note.id)}
          title={note.title}
        >
          <span className={css.tabTitle}>{note.title}</span>
          <span
            className={css.tabClose}
            onClick={e => handleCloseNote(note.id, e)}
            role="button"
            title="Close Note"
          >
            ×
          </span>
        </button>
      ))}
      <button
        type="button"
        className={css.newTabBtn}
        onClick={handleAddNote}
        title="New Note"
        aria-label="New Note"
      >
        +
      </button>
    </div>
  )

  if (isDocked) {
    return (
      <div className={css.npRootDocked}>
        {subrowEl ? createPortal(notesSubrowContent, subrowEl) : null}
        <div className={css.npDockedToolbar}>
          <div className={css.npToolbarLeft} />
          <div className={css.npActions}>
            {status && <span className={css.npStatus}>{status}</span>}
            <Button variant="primary" size="sm" onClick={save}>Save</Button>
            <button
              type="button"
              className={css.iconBtn}
              title="Fullscreen"
              aria-label="Fullscreen"
              onClick={handleFullscreen}
            >
              <IconFullscreen size={16} />
            </button>
          </div>
        </div>
        <textarea
          className={css.npTaDocked}
          value={activeNote.content}
          placeholder="Type here — I can read what you write. It autosaves as you go."
          onChange={onChange}
        />
      </div>
    )
  }

  const fullscreenElement = (
    <div className={css.npRoot}>
      <div className={css.npHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconListPenOutline16 size={18} />
          <h2 className={css.npTitle}>Notepad</h2>
        </div>
        <div className={css.npActions}>
          <span className={css.npStatus}>{status}</span>
          <Button variant="primary" size="sm" onClick={save}>Save</Button>
          <button
            type="button"
            className={css.iconBtn}
            title="Dock in Workbench"
            aria-label="Dock in Workbench"
            onClick={handleDock}
          >
            <IconDock size={16} />
          </button>
          <button type="button" className={css.close} aria-label="Close" title="Close" onClick={handleClose}>
            <IconCloseOutline16 size={16} />
          </button>
        </div>
      </div>
      <textarea
        className={css.npTa}
        value={activeNote.content}
        placeholder="Type here — I can read what you write. It autosaves as you go."
        onChange={onChange}
      />
    </div>
  )

  return typeof document !== 'undefined'
    ? createPortal(fullscreenElement, document.body)
    : fullscreenElement
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

  const modalElement = (
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
                    <div className={css.cardIcon}>
                      {app.id === 'notepad' ? <IconListPenOutline16 size={22} /> : (app.icon || '📦')}
                    </div>
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
                    <Button
                      variant="outline"
                      size="sm"
                      className={css.cardActionBtn}
                      icon={<IconDock size={14} />}
                      title="Dock into Workbench"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('workbench:open-app', {
                          detail: { appId: app.id, title: app.name, icon: app.icon },
                        }))
                        onClose()
                      }}
                    >
                      Dock
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className={css.cardActionBtn}
                      icon={<IconFullscreen size={14} />}
                      title="Open in Fullscreen"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('workbench:close-details'))
                        onOpen(app.id)
                      }}
                    >
                      Fullscreen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined'
    ? createPortal(modalElement, document.body)
    : modalElement
}

/** Hosts an application inside the Workbench App Pane slot. */
export function WorkbenchAppHost({
  appStore,
  params,
}: {
  appStore: AppStoreRemote
  params?: Record<string, unknown> | undefined
}) {
  const appId = (params?.appId as string) || 'notepad'
  if (appId === 'notepad') {
    return (
      <NotepadApp
        appStore={appStore}
        mode="docked"
        onFullscreen={() => {
          window.dispatchEvent(new CustomEvent('workbench:close-details'))
          window.dispatchEvent(new CustomEvent('saddle:open-fullscreen-app', { detail: { appId: 'notepad' } }))
        }}
      />
    )
  }
  return (
    <div style={{ padding: 24, textAlign: 'center', color: 'var(--dsw-alias-label-secondary)' }}>
      App not found: {appId}
    </div>
  )
}

export function AppsEntry({ wide = true, appStore }: { wide?: boolean; appStore: AppStoreRemote }) {
  const [open, setOpen] = useState(false)
  const [activeApp, setActiveApp] = useState<string | null>(null)

  useEffect(() => {
    const onOpenFullscreen = (event: Event) => {
      const custom = event as CustomEvent<{ appId: string }>
      if (custom.detail?.appId) {
        window.dispatchEvent(new CustomEvent('workbench:close-details'))
        setActiveApp(custom.detail.appId)
        setOpen(true)
      }
    }
    window.addEventListener('saddle:open-fullscreen-app', onOpenFullscreen)
    return () => window.removeEventListener('saddle:open-fullscreen-app', onOpenFullscreen)
  }, [])

  const closeAll = () => { setActiveApp(null); setOpen(false) }

  const renderActiveApp = (id: string) => {
    switch (id) {
      case 'notepad': return <NotepadApp appStore={appStore} mode="fullscreen" onClose={closeAll} />
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
