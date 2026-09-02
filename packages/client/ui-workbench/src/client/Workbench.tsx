/**
 * Workbench: the tabbed dock that owns the `details` details column. To keep
 * the existing tool-details inspector visually unchanged, the tab strip is
 * hidden while only the single Details pane is open; it appears once a second
 * pane is added. A subtle floating '+' (bottom-right) reveals the add menu. The
 * Details pane is the base tab and cannot be closed.
 */

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { IconPlusOutline16, IconFullscreenOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkbenchPaneKind } from './types.ts'
import { NS } from './locales.ts'
import type {} from './contract/slots.ts'
import css from './Workbench.module.css'

/** Injected share: the workbench controls the details column through ctx.layout. */
export interface WorkbenchInjected {
  /** Close the details column (layout geometry stays with ctx.layout). */
  closeDetails: () => void
  /** Open the details column (no-op when already open). */
  openDetails: () => void
}

/** Full workbench props: runtime share, declared pane slots, locale, inject face. */
export type WorkbenchProps =
  PropsRuntime<'details'>
  & PropsRenderSlots<'workbench.pane.details' | 'workbench.pane.jobs' | 'workbench.pane.browser' | 'workbench.pane.files'>
  & PropsLocale<typeof NS>
  & WorkbenchInjected

/** One open tab: a stable id, the pane kind it renders, and any open params. */
interface OpenTab {
  id: string
  kind: WorkbenchPaneKind
  params?: Record<string, unknown> | undefined
}

/** Pane kinds the workbench can host, in the order the add menu lists them. */
const AVAILABLE_PANES: readonly WorkbenchPaneKind[] = ['details', 'jobs', 'browser', 'files']

/** The pane label for a kind, from the workbench locale namespace. */
function paneLabel(kind: WorkbenchPaneKind, t: WorkbenchProps['t']): string {
  switch (kind) {
    case 'details': return t('workbench.pane.details')
    case 'jobs': return t('workbench.pane.jobs')
    case 'browser': return t('workbench.pane.browser')
    case 'files': return t('workbench.pane.files')
  }
}

/** The pane slot key a kind renders under. */
function paneSlot(kind: WorkbenchPaneKind): 'workbench.pane.details' | 'workbench.pane.jobs' | 'workbench.pane.browser' | 'workbench.pane.files' {
  switch (kind) {
    case 'details': return 'workbench.pane.details'
    case 'jobs': return 'workbench.pane.jobs'
    case 'browser': return 'workbench.pane.browser'
    case 'files': return 'workbench.pane.files'
  }
}

/**
 * Remove a non-base tab by id. The Details base tab is never removed, so the
 * column always keeps one pane and therefore its own close affordance.
 */
function dropTab(tabs: readonly OpenTab[], id: string): OpenTab[] {
  return tabs.filter(tab => tab.kind === 'details' || tab.id !== id)
}

/** Render the active pane through its declared pane slot. */
function renderPane(tab: OpenTab | undefined, renderSlot: WorkbenchProps['renderSlot']): ReactNode {
  if (tab === undefined) return null
  return renderSlot(paneSlot(tab.kind), { params: tab.params })
}

/**
 * Render the details column dock.
 * @param props - runtime share, declared pane slots, locale, inject face.
 * @returns the workbench element.
 */
export function Workbench({ renderSlot, t, openDetails }: WorkbenchProps) {
  const [tabs, setTabs] = useState<OpenTab[]>(() => [{ id: 'details', kind: 'details' }])
  const [activeId, setActiveId] = useState('details')
  const [addOpen, setAddOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  const active = useMemo(
    () => tabs.find(tab => tab.id === activeId) ?? tabs[0],
    [tabs, activeId],
  )

  // The strip is hidden while only the base Details pane is open, so the default
  // column looks exactly like the previous single tool-details inspector.
  const showStrip = tabs.length > 1
  const available = AVAILABLE_PANES.filter(kind => !tabs.some(tab => tab.kind === kind))

  const openPane = useCallback((kind: WorkbenchPaneKind, params?: Record<string, unknown>): void => {
    const id = kind
    setTabs(current => current.some(tab => tab.id === id)
      ? current.map(tab => tab.id === id && params !== undefined ? { ...tab, params } : tab)
      : [...current, { id, kind, ...(params === undefined ? {} : { params }) }])
    setActiveId(id)
    setAddOpen(false)
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape' || !addOpen) return
    event.preventDefault()
    setAddOpen(false)
  }

  // URL auto-open: clicking any http(s) link anywhere opens it in the Browser
  // pane instead of navigating away. Delegated at document level so agent-
  // surfaced URLs in the conversation open here by default.
  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null
      const anchor = target?.closest('a[href^="http"]') as HTMLAnchorElement | null
      if (anchor === null) return
      const href = anchor.getAttribute('href')
      if (href === null) return
      event.preventDefault()
      openPane('browser', { url: href })
      openDetails()
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [openDetails, openPane])

  // File chips / @-mentions carry data-workbench-file; route them into the Files
  // pane in the CAPTURE phase so the host openFile handler does not also run.
  useEffect(() => {
    const onFileClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null
      const chip = target?.closest<HTMLElement>('[data-workbench-file]')
      if (chip !== null && chip !== undefined) {
        const path = chip.getAttribute('data-workbench-file')
        if (path !== null) {
          event.preventDefault()
          event.stopPropagation()
          openPane('files', { path })
          openDetails()
          return
        }
      }

      const anchor = target?.closest('a[href^="file:"]') as HTMLAnchorElement | null
      if (anchor !== null) {
        const href = anchor.getAttribute('href')
        if (href !== null) {
          try {
            const url = new URL(href)
            event.preventDefault()
            event.stopPropagation()
            openPane('files', { path: decodeURIComponent(url.pathname) })
            openDetails()
          } catch {}
        }
      }
    }
    document.addEventListener('click', onFileClick, true)
    return () => document.removeEventListener('click', onFileClick, true)
  }, [openDetails, openPane])

  return (
    <div className={`${css.root} ${fullscreen ? css.rootFullscreen : ''}`} data-workbench="" onKeyDown={onKeyDown}>
      {showStrip && (
        <div className={css.strip} role="tablist" aria-label={t('workbench.addMenu')}>
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`${css.tab} ${tab.id === active?.id ? css.tabActive : ''}`}
              role="tab"
              aria-selected={tab.id === active?.id}
              tabIndex={0}
              onClick={() => { setActiveId(tab.id) }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActiveId(tab.id) }
              }}
            >
              <span className={css.tabLabel}>{paneLabel(tab.kind, t)}</span>
              {tab.kind !== 'details' && (
                <button
                  type="button"
                  className={css.tabClose}
                  aria-label={t('workbench.tabs.close')}
                  onClick={(event) => {
                    event.stopPropagation()
                    const next = dropTab(tabs, tab.id)
                    setTabs(next)
                    if (activeId === tab.id) setActiveId('details')
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className={css.body}>
        {renderPane(active, renderSlot)}
      </div>
      <button
        type="button"
        className={css.add}
        aria-label={t('workbench.add')}
        aria-expanded={addOpen}
        onClick={() => { setAddOpen(open => !open) }}
      >
        <IconPlusOutline16 size={14} />
      </button>
      <button
        type="button"
        className={css.fullscreen}
        aria-label={fullscreen ? t('workbench.exitFullscreen') : t('workbench.fullscreen')}
        title={fullscreen ? t('workbench.exitFullscreen') : t('workbench.fullscreen')}
        onClick={() => { setFullscreen(value => !value) }}
      >
        <IconFullscreenOutline16 size={14} />
      </button>
      {addOpen && (
        <div className={css.addMenu} role="menu" aria-label={t('workbench.addMenu')}>
          {available.length === 0
            ? <div className={css.addEmpty}>{t('workbench.empty')}</div>
            : available.map(kind => (
              <button
                key={kind}
                type="button"
                role="menuitem"
                className={css.addItem}
                onClick={() => { openPane(kind) }}
              >
                {paneLabel(kind, t)}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
