/**
 * Workbench files pane: an explorer (directory list) plus a file viewer. It
 * starts at the session cwd (or an explicit file path from its open params),
 * lists a directory's children, and reads a selected file into the viewer. An
 * 'Open externally' control hands the selected file to the host's default app.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { IconLinkOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { NS } from './locales.ts'
import type {} from './contract/slots.ts'
import css from './files-pane.module.css'

/** Injected face: the host file primitives bound from the workspaces service. */
export interface FilesPaneInjected {
  listFiles: (path: string, signal?: AbortSignal) => Promise<{
    path: string
    entries: WorkspaceFileEntry[]
    truncated: boolean
  }>
  readFile: (path: string, signal?: AbortSignal) => Promise<{ path: string; text: string }>
  openPath: (path: string) => Promise<void>
}

/** Full files-pane props: owner params, runtime share, locale, inject face. */
export type FilesPaneProps = PropsRuntime<'workbench.pane.files'> & PropsLocale<typeof NS> & FilesPaneInjected

/** The parent directory of an absolute path ('/a/b' -> '/a'). */
function parentPath(path: string): string {
  const trimmed = path.replace(/\/+$/, '')
  const idx = trimmed.lastIndexOf('/')
  return idx <= 0 ? '/' : trimmed.slice(0, idx)
}

/** Render the files pane. */
export function FilesPane({ params, sessionId, useSessions, listFiles, readFile, openPath, t }: FilesPaneProps) {
  const cwd = useSessions(list => list.byId[sessionId]?.cwd)
  const initialPath = typeof params?.path === 'string' ? params.path : ''
  const [dir, setDir] = useState(initialPath === '' ? (cwd ?? '/') : parentPath(initialPath))
  const [entries, setEntries] = useState<{ name: string; path: string; isDir: boolean; hidden: boolean }[]>([])
  const [selected, setSelected] = useState<string | null>(initialPath === '' ? null : initialPath)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  const load = useCallback((path: string) => {
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setDir(path)
    setSelected(null)
    setText('')
    setLoading(true)
    setError(null)
    void listFiles(path, controller.signal).then((result) => {
      if (controller.signal.aborted) return
      setEntries(result.entries)
      setLoading(false)
    }).catch((reason: unknown) => {
      if (controller.signal.aborted) return
      setEntries([])
      setError(reason instanceof Error ? reason.message : String(reason))
      setLoading(false)
    })
  }, [listFiles])

  const open = useCallback((path: string) => {
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setSelected(path)
    setText('')
    setLoading(true)
    setError(null)
    void readFile(path, controller.signal).then((result) => {
      if (controller.signal.aborted) return
      setText(result.text)
      setLoading(false)
    }).catch((reason: unknown) => {
      if (controller.signal.aborted) return
      setError(reason instanceof Error ? reason.message : String(reason))
      setLoading(false)
    })
  }, [readFile])

  useEffect(() => { if (initialPath !== '') open(initialPath); else load(dir) }, [])

  const parent = parentPath(dir)
  return (
    <div className={css.root}>
      <div className={css.bar}>
        <button type="button" className={css.ghost} disabled={parent === dir} onClick={() => { load(parent) }}>..</button>
        <span className={css.dir} title={dir}>{dir}</span>
        {selected !== null && (
          <button type="button" className={css.ghost} aria-label={t('workbench.browser.open')} onClick={() => { void openPath(selected) }}>
            <IconLinkOutline16 size={14} />
          </button>
        )}
      </div>
      {error !== null && <div className={css.error}>{error}</div>}
      <div className={css.body}>
        {selected === null ? (
          <ul className={css.list}>
            {entries.map(entry => (
              <li key={entry.path}>
                <button type="button" className={css.row} onClick={() => { if (entry.isDir) load(entry.path); else open(entry.path) }}>
                  <span className={css.icon}>{entry.isDir ? '/' : ''}</span>
                  <span className={css.name}>{entry.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <pre className={css.code}>{loading ? '…' : text}</pre>
        )}
      </div>
    </div>
  )
}
