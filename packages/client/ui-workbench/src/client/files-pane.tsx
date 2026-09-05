/**
 * Workbench files pane: a comprehensive VPS filesystem explorer and editor.
 * Supports:
 * - Full VPS / host directory navigation and clickable breadcrumbs
 * - Quick jump presets (/host, /root, /host/root/apps, cwd)
 * - Direct path jump input
 * - Search filter within directory
 * - Multi-select checkboxes and batch deletion with confirmation
 * - Create new files and folders
 * - Rename and single delete
 * - Rich file viewer (markdown, html preview, images)
 * - Full code/text editor with Cmd+S / Ctrl+S saving and unsaved changes tracking
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IconLinkOutline16, IconEyeOutline16, IconCodeOutline16,
  IconPlusOutline16, IconTrashOutline16,
  IconRefreshOutline16, IconEditOutline16, IconCheckOutline16,
  IconCloseOutline16, IconFolderClose16, IconEllipsisOutline16,
  IconCopyOutline16, IconSendOutline14,
  Menu, MarkdownText, type IconProps,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { NS } from './locales.ts'
import type {} from './contract/slots.ts'
import css from './files-pane.module.css'

/** One entry in a directory listing (a file or a folder). */
export interface WorkspaceFileEntry {
  name: string
  path: string
  isDir?: boolean | undefined
  sizeBytes?: number | undefined
  hidden?: boolean | undefined
}

/** Injected face: the host file primitives bound from the workspaces service. */
export interface FilesPaneInjected {
  listFiles: (path: string, signal?: AbortSignal) => Promise<{
    path: string
    entries: WorkspaceFileEntry[]
    truncated: boolean
  }>
  readFile: (path: string, signal?: AbortSignal) => Promise<{ path: string; text: string }>
  writeFile?: (path: string, content: string) => Promise<{ path: string; bytesWritten: number }>
  deletePaths?: (paths: string[]) => Promise<{ deleted: string[] }>
  createFile?: (path: string, content?: string) => Promise<{ path: string }>
  renamePath?: (oldPath: string, newPath: string) => Promise<{ path: string }>
  createDirectory?: (path: string, name: string) => Promise<string>
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

/** Format byte size to human readable string. */
function formatSize(bytes?: number): string {
  if (bytes === undefined) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/** Get a clean emoji or icon descriptor for a file/folder. */
function fileIcon(name: string, isDir?: boolean): string {
  if (isDir) return '📁'
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

/** Crisp, minimalist hard drive SVG icon for root volume */
function IconHardDrive({ size = 12, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <circle cx="11.5" cy="8" r="0.8" fill="currentColor" stroke="none" />
      <line x1="4.5" y1="8" x2="7.5" y2="8" />
    </svg>
  )
}

/** Crisp, minimalist star SVG icon for pinned presets */
function IconStar({ size = 11, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M8 1.75l1.87 3.79 4.18.61-3.03 2.95.72 4.16L8 11.3l-3.74 1.96.72-4.16-3.03-2.95 4.18-.61L8 1.75z" />
    </svg>
  )
}

export function FilesPane({
  params,
  sessionId,
  useSessions,
  listFiles,
  readFile,
  writeFile,
  deletePaths,
  createFile,
  renamePath,
  createDirectory,
  openPath,
  t,
}: FilesPaneProps) {
  const cwd = useSessions(list => list.byId[sessionId]?.cwd)
  const initialPath = typeof params?.path === 'string' ? params.path : ''
  const [dir, setDir] = useState(initialPath === '' ? (cwd ?? '/') : parentPath(initialPath))
  const [entries, setEntries] = useState<WorkspaceFileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Address Bar & Navigation
  const [isEditingPath, setIsEditingPath] = useState(false)
  const [pathInput, setPathInput] = useState(dir)
  const [showHidden, setShowHidden] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Target DOM element in Workbench header row 2
  const [subrowEl, setSubrowEl] = useState<HTMLElement | null>(() => {
    return typeof document !== 'undefined' ? document.getElementById('workbench-strip-subrow') : null
  })

  useEffect(() => {
    if (!subrowEl && typeof document !== 'undefined') {
      const el = document.getElementById('workbench-strip-subrow')
      if (el) setSubrowEl(el)
    }
  }, [subrowEl])

  // Custom user-pinned presets (stored in localStorage)
  const [pinnedPresets, setPinnedPresets] = useState<Array<{ name: string; path: string }>>(() => {
    try {
      const saved = localStorage.getItem('saddle:pinned_file_presets')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Save pinned presets to localStorage
  const savePinnedPresets = (newPresets: Array<{ name: string; path: string }>) => {
    setPinnedPresets(newPresets)
    try {
      localStorage.setItem('saddle:pinned_file_presets', JSON.stringify(newPresets))
    } catch {
      // Ignore localStorage errors
    }
  }

  const togglePinCurrentDir = () => {
    const existingIdx = pinnedPresets.findIndex(p => p.path === dir)
    if (existingIdx >= 0) {
      // Unpin
      const updated = pinnedPresets.filter((_, idx) => idx !== existingIdx)
      savePinnedPresets(updated)
    } else {
      // Pin: get folder name
      const name = dir === '/' ? 'Root' : (dir.split('/').filter(Boolean).pop() || dir)
      const updated = [...pinnedPresets, { name, path: dir }]
      savePinnedPresets(updated)
    }
  }

  const isCurrentDirPinned = pinnedPresets.some(p => p.path === dir)

  // Multi-select & Batch
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null)

  const addPathToChat = useCallback((path: string) => {
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea[data-conversation-input]')
      || document.querySelector<HTMLTextAreaElement>('footer textarea')
      || document.querySelector<HTMLTextAreaElement>('main textarea')
      || document.querySelector<HTMLTextAreaElement>('textarea')
    if (textarea) {
      const current = textarea.value
      const insert = (current && !current.endsWith(' ') ? ' @' : '@') + path + ' '
      const start = textarea.selectionStart ?? current.length
      const end = textarea.selectionEnd ?? current.length
      const next = current.substring(0, start) + insert + current.substring(end)
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      if (nativeSetter) nativeSetter.call(textarea, next)
      else textarea.value = next
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      textarea.dispatchEvent(new Event('change', { bubbles: true }))
      textarea.focus()
      const pos = start + insert.length
      textarea.setSelectionRange(pos, pos)
    }
  }, [])

  const copyPathToClipboard = useCallback((path: string) => {
    void navigator.clipboard.writeText(path)
  }, [])

  // Inline Prompts (new file, new folder, rename, delete confirm)
  type PromptMode = 'new-file' | 'new-folder' | 'rename' | 'delete-selected' | 'delete-single'
  const [promptMode, setPromptMode] = useState<PromptMode | null>(null)
  const [promptTarget, setPromptTarget] = useState<string | null>(null)
  const [promptInputText, setPromptInputText] = useState('')

  // File Viewer & Editor
  const [selectedFile, setSelectedFile] = useState<string | null>(initialPath === '' ? null : initialPath)
  const [originalText, setOriginalText] = useState('')
  const [editText, setEditText] = useState('')
  const [previewMode, setPreviewMode] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveBanner, setSaveBanner] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const editorRef = useRef<HTMLTextAreaElement | null>(null)

  const isDirty = useMemo(() => selectedFile !== null && editText !== originalText, [selectedFile, editText, originalText])

  // Load directory entries
  const load = useCallback((path: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setDir(path)
    setPathInput(path)
    setIsEditingPath(false)
    setSelectedPaths(new Set())
    setPromptMode(null)
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

  // Open a file for viewing & editing
  const openFile = useCallback((path: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSelectedFile(path)
    setOriginalText('')
    setEditText('')
    setSaveBanner(null)
    setLoading(true)
    setError(null)

    // Preview mode by default for Markdown, HTML, images
    const isVisual = /\.(md|markdown|html|htm|png|jpg|jpeg|gif|svg|webp)$/i.test(path)
    setPreviewMode(isVisual)

    void readFile(path, controller.signal).then((result) => {
      if (controller.signal.aborted) return
      setOriginalText(result.text)
      setEditText(result.text)
      setLoading(false)
    }).catch((reason: unknown) => {
      if (controller.signal.aborted) return
      setError(reason instanceof Error ? reason.message : String(reason))
      setLoading(false)
    })
  }, [readFile])

  // Save current file
  const handleSave = useCallback(async () => {
    if (!selectedFile || !writeFile) return
    setIsSaving(true)
    setError(null)
    try {
      await writeFile(selectedFile, editText)
      setOriginalText(editText)
      setSaveBanner('Saved!')
      setTimeout(() => setSaveBanner(null), 2500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSaving(false)
    }
  }, [selectedFile, editText, writeFile])

  // Keyboard shortcut Cmd+S / Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        if (selectedFile !== null) {
          e.preventDefault()
          void handleSave()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedFile, handleSave])

  useEffect(() => {
    if (initialPath !== '') openFile(initialPath)
    else load(dir)
  }, [])

  // Multi-select toggle
  const toggleSelect = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedPaths.size === filteredEntries.length) {
      setSelectedPaths(new Set())
    } else {
      setSelectedPaths(new Set(filteredEntries.map(e => e.path)))
    }
  }

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (!showHidden && entry.hidden) return false
      if (searchQuery.trim() !== '') {
        return entry.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      }
      return true
    })
  }, [entries, showHidden, searchQuery])

  // Prompt action execution
  const executePrompt = async () => {
    if (!promptMode) return
    setError(null)
    try {
      if (promptMode === 'new-file') {
        const name = promptInputText.trim()
        if (!name) return
        const filePath = `${dir.replace(/\/+$/, '')}/${name}`
        if (createFile) {
          await createFile(filePath, '')
        } else if (writeFile) {
          await writeFile(filePath, '')
        }
        setPromptMode(null)
        load(dir)
        openFile(filePath)
      } else if (promptMode === 'new-folder') {
        const name = promptInputText.trim()
        if (!name) return
        if (createDirectory) {
          await createDirectory(dir, name)
        }
        setPromptMode(null)
        load(dir)
      } else if (promptMode === 'rename' && promptTarget) {
        const newName = promptInputText.trim()
        if (!newName) return
        const newPath = `${dir.replace(/\/+$/, '')}/${newName}`
        if (renamePath) {
          await renamePath(promptTarget, newPath)
        }
        setPromptMode(null)
        load(dir)
      } else if (promptMode === 'delete-selected') {
        if (deletePaths && selectedPaths.size > 0) {
          await deletePaths(Array.from(selectedPaths))
        }
        setSelectedPaths(new Set())
        setPromptMode(null)
        load(dir)
      } else if (promptMode === 'delete-single' && promptTarget) {
        if (deletePaths) {
          await deletePaths([promptTarget])
        }
        if (selectedFile === promptTarget) {
          setSelectedFile(null)
        }
        setPromptMode(null)
        load(dir)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    const parts = dir.split('/').filter(Boolean)
    const crumbs: { name: string; path: string }[] = [{ name: 'root', path: '/' }]
    let cur = ''
    for (const part of parts) {
      cur += `/${part}`
      crumbs.push({ name: part, path: cur })
    }
    return crumbs
  }, [dir])

  const presetsContent = (
    <div className={css.presetsBar}>
      {/* Active Session Workspace (Available everywhere) */}
      {cwd && (
        <button
          type="button"
          className={`${css.presetChip} ${dir === cwd ? css.presetChipActive : ''}`}
          onClick={() => load(cwd)}
          title={`Session Workspace (${cwd})`}
        >
          <IconFolderClose16 size={12} className={css.chipIcon} />
          <span>Workspace</span>
        </button>
      )}

      {/* System Root (Universal) */}
      <button
        type="button"
        className={`${css.presetChip} ${dir === '/' ? css.presetChipActive : ''}`}
        onClick={() => load('/')}
        title="System Root (/)"
      >
        <IconHardDrive size={12} className={css.chipIcon} />
        <span>/ Root</span>
      </button>

      {/* User Pinned Custom Presets */}
      {pinnedPresets.map(preset => (
        <span key={preset.path} className={css.pinnedChipGroup}>
          <button
            type="button"
            className={`${css.presetChip} ${dir === preset.path ? css.presetChipActive : ''}`}
            onClick={() => load(preset.path)}
            title={preset.path}
          >
            <IconStar size={11} className={css.chipIcon} />
            <span>{preset.name}</span>
          </button>
          <button
            type="button"
            className={css.pinnedRemoveBtn}
            onClick={(e) => {
              e.stopPropagation()
              savePinnedPresets(pinnedPresets.filter(p => p.path !== preset.path))
            }}
            title={`Unpin ${preset.name}`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )

  return (
    <div className={css.root}>
      {/* Renders in Workbench header row 2 (aligned with Chat/Trajectory tabs) or fallback inline */}
      {subrowEl ? createPortal(presetsContent, subrowEl) : presetsContent}

      {/* --- TOP NAVIGATION BAR --- */}
      <div className={css.navBar}>
        {isEditingPath ? (
          <div className={css.pathInputWrapper}>
            <input
              type="text"
              className={css.pathInput}
              value={pathInput}
              autoFocus
              onChange={e => setPathInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') load(pathInput.trim() || '/')
                if (e.key === 'Escape') {
                  setPathInput(dir)
                  setIsEditingPath(false)
                }
              }}
              placeholder="/host, /root, /etc..."
            />
            <button
              type="button"
              className={`${css.btn} ${css.btnPrimary}`}
              onClick={() => load(pathInput.trim() || '/')}
            >
              Go
            </button>
            <button
              type="button"
              className={css.ghost}
              onClick={() => {
                setPathInput(dir)
                setIsEditingPath(false)
              }}
            >
              <IconCloseOutline16 size={12} />
            </button>
          </div>
        ) : (
          <div className={css.breadcrumbs} onDoubleClick={() => setIsEditingPath(true)}>
            {breadcrumbs.map((crumb, idx) => (
              <span key={crumb.path} style={{ display: 'inline-flex', alignItems: 'center' }}>
                {idx > 0 && <span className={css.crumbSep}>/</span>}
                <button
                  type="button"
                  className={`${css.crumb} ${idx === breadcrumbs.length - 1 ? css.crumbActive : ''}`}
                  onClick={() => load(crumb.path)}
                  title={crumb.path}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>
        )}

        <button
          type="button"
          className={css.ghost}
          title={isEditingPath ? 'Done editing path' : 'Type path manually'}
          onClick={() => {
            if (!isEditingPath) setPathInput(dir)
            setIsEditingPath(!isEditingPath)
          }}
        >
          <IconEditOutline16 size={14} />
        </button>

        <button
          type="button"
          className={css.ghost}
          title={isCurrentDirPinned ? 'Unpin this folder from presets' : 'Pin this folder to presets'}
          onClick={togglePinCurrentDir}
          style={isCurrentDirPinned ? { color: 'var(--dsw-alias-interactive-primary, #3b82f6)' } : undefined}
        >
          {isCurrentDirPinned ? '★' : '☆'}
        </button>

        <button
          type="button"
          className={css.ghost}
          title="Refresh current folder"
          onClick={() => load(dir)}
        >
          <IconRefreshOutline16 size={14} />
        </button>
      </div>

      {/* --- ERROR MESSAGE --- */}
      {error !== null && (
        <div className={css.error}>
          <span>{error}</span>
          <button type="button" className={css.ghost} style={{ float: 'right', padding: 0 }} onClick={() => setError(null)}>
            <IconCloseOutline16 size={12} />
          </button>
        </div>
      )}

      {/* --- FILE VIEWER / EDITOR VIEW --- */}
      {selectedFile !== null ? (
        <div className={css.editorContainer}>
          <div className={css.editorBar}>
            <div className={css.fileMeta}>
              <button
                type="button"
                className={css.btn}
                onClick={() => setSelectedFile(null)}
                title="Return to folder listing"
              >
                ← Back
              </button>
              <span className={css.fileName} title={selectedFile}>
                {selectedFile.split('/').pop()}
              </span>
              {isDirty ? (
                <span className={css.dirtyBadge}>● Unsaved</span>
              ) : saveBanner ? (
                <span className={css.savedBadge}>✓ {saveBanner}</span>
              ) : null}
            </div>

            <div className={css.editorActions}>
              <button
                type="button"
                className={css.ghost}
                aria-label={previewMode ? 'Edit Source' : 'Visual Preview'}
                title={previewMode ? 'Switch to Source Editor' : 'Switch to Visual Preview'}
                onClick={() => setPreviewMode(!previewMode)}
              >
                {previewMode ? <IconCodeOutline16 size={14} /> : <IconEyeOutline16 size={14} />}
              </button>

              <button
                type="button"
                className={`${css.btn} ${css.btnPrimary}`}
                disabled={isSaving || !isDirty}
                onClick={() => void handleSave()}
                title="Save file (⌘S / Ctrl+S)"
              >
                <IconCheckOutline16 size={14} />
                {isSaving ? 'Saving…' : 'Save'}
              </button>

              <button
                type="button"
                className={css.ghost}
                aria-label={t('workbench.browser.open')}
                title="Open with system default app"
                onClick={() => { void openPath(selectedFile) }}
              >
                <IconLinkOutline16 size={14} />
              </button>

              <button
                type="button"
                className={`${css.ghost} ${css.btnDanger}`}
                title="Delete this file"
                onClick={() => {
                  setPromptMode('delete-single')
                  setPromptTarget(selectedFile)
                }}
              >
                <IconTrashOutline16 size={14} />
              </button>
            </div>
          </div>

          {/* Delete prompt while in file view */}
          {promptMode === 'delete-single' && (
            <div className={css.promptBar}>
              <span style={{ fontSize: 12, color: '#ef4444' }}>
                Permanently delete <b>{selectedFile.split('/').pop()}</b>?
              </span>
              <button type="button" className={`${css.btn} ${css.btnDanger}`} onClick={() => void executePrompt()}>
                Yes, Delete
              </button>
              <button type="button" className={css.btn} onClick={() => setPromptMode(null)}>
                Cancel
              </button>
            </div>
          )}

          {/* Editor Body */}
          <div className={css.body} style={{ display: 'flex', flexDirection: 'column' }}>
            {previewMode && !loading ? (
              originalText.startsWith('data:image/') ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', overflow: 'hidden' }}>
                  <img src={originalText} alt={selectedFile} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </div>
              ) : selectedFile.endsWith('.html') || selectedFile.endsWith('.htm') ? (
                <iframe
                  style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
                  srcDoc={editText}
                  title="HTML Preview"
                  sandbox="allow-scripts"
                />
              ) : (
                <div style={{ padding: '16px 20px', overflowY: 'auto', height: '100%', userSelect: 'text' }}>
                  <MarkdownText text={editText} />
                </div>
              )
            ) : (
              <textarea
                ref={editorRef}
                className={css.codeTextarea}
                value={editText}
                disabled={loading}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Tab') {
                    e.preventDefault()
                    const start = e.currentTarget.selectionStart
                    const end = e.currentTarget.selectionEnd
                    const next = editText.substring(0, start) + '  ' + editText.substring(end)
                    setEditText(next)
                    requestAnimationFrame(() => {
                      if (editorRef.current) {
                        editorRef.current.selectionStart = editorRef.current.selectionEnd = start + 2
                      }
                    })
                  }
                }}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
              />
            )}
          </div>

          <div className={css.editorFooter}>
            <span>{selectedFile}</span>
            <span>
              {editText.split('\n').length} lines · {editText.length} chars
            </span>
          </div>
        </div>
      ) : (
        /* --- DIRECTORY EXPLORER VIEW --- */
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Actions & Multi-select Toolbar */}
          <div className={css.actionBar}>
            <div className={css.actionGroup}>
              <input
                type="checkbox"
                className={css.checkbox}
                checked={filteredEntries.length > 0 && selectedPaths.size === filteredEntries.length}
                onChange={toggleSelectAll}
                title="Select all"
              />

              {selectedPaths.size > 0 ? (
                <>
                  <span className={css.selectionPill}>
                    <span className={css.btnTextFull}>{selectedPaths.size} selected</span>
                    <span className={css.btnTextShort}>{selectedPaths.size}</span>
                  </span>
                  <button
                    type="button"
                    className={`${css.btn} ${css.btnDanger}`}
                    onClick={() => {
                      setPromptMode('delete-selected')
                    }}
                    title={`Delete ${selectedPaths.size} item(s)`}
                  >
                    <IconTrashOutline16 size={13} />
                    <span className={css.btnTextFull}>Delete Selected</span>
                    <span className={css.btnTextShort}>Delete</span>
                  </button>
                  <button
                    type="button"
                    className={css.ghost}
                    onClick={() => setSelectedPaths(new Set())}
                    title="Clear selection"
                  >
                    Clear
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={css.btn}
                    onClick={() => {
                      setPromptMode('new-file')
                      setPromptInputText('')
                    }}
                    title="Create new file"
                  >
                    <IconPlusOutline16 size={13} />
                    <span className={css.btnTextFull}>New File</span>
                    <span className={css.btnTextShort}>File</span>
                  </button>
                  <button
                    type="button"
                    className={css.btn}
                    onClick={() => {
                      setPromptMode('new-folder')
                      setPromptInputText('')
                    }}
                    title="Create new folder"
                  >
                    <IconPlusOutline16 size={13} />
                    <span className={css.btnTextFull}>New Folder</span>
                    <span className={css.btnTextShort}>Folder</span>
                  </button>
                </>
              )}
            </div>

            <div className={css.actionGroup}>
              <input
                type="text"
                className={css.searchInput}
                placeholder="Filter files…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button
                type="button"
                className={`${css.ghost} ${showHidden ? css.presetChipActive : ''}`}
                title={showHidden ? 'Hide dotfiles' : 'Show hidden dotfiles'}
                onClick={() => setShowHidden(!showHidden)}
              >
                .{showHidden ? '✓' : ''}
              </button>
            </div>
          </div>

          {/* Inline Action Prompts */}
          {promptMode && (
            <div className={css.promptBar}>
              {promptMode === 'new-file' && (
                <>
                  <span style={{ fontWeight: 500, fontSize: 12 }}>New File:</span>
                  <input
                    type="text"
                    className={css.promptInput}
                    placeholder="filename.txt or script.py"
                    autoFocus
                    value={promptInputText}
                    onChange={e => setPromptInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void executePrompt()
                      if (e.key === 'Escape') setPromptMode(null)
                    }}
                  />
                  <button type="button" className={`${css.btn} ${css.btnPrimary}`} onClick={() => void executePrompt()}>
                    Create
                  </button>
                </>
              )}
              {promptMode === 'new-folder' && (
                <>
                  <span style={{ fontWeight: 500, fontSize: 12 }}>New Folder:</span>
                  <input
                    type="text"
                    className={css.promptInput}
                    placeholder="folder_name"
                    autoFocus
                    value={promptInputText}
                    onChange={e => setPromptInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void executePrompt()
                      if (e.key === 'Escape') setPromptMode(null)
                    }}
                  />
                  <button type="button" className={`${css.btn} ${css.btnPrimary}`} onClick={() => void executePrompt()}>
                    Create
                  </button>
                </>
              )}
              {promptMode === 'rename' && (
                <>
                  <span style={{ fontWeight: 500, fontSize: 12 }}>Rename:</span>
                  <input
                    type="text"
                    className={css.promptInput}
                    autoFocus
                    value={promptInputText}
                    onChange={e => setPromptInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void executePrompt()
                      if (e.key === 'Escape') setPromptMode(null)
                    }}
                  />
                  <button type="button" className={`${css.btn} ${css.btnPrimary}`} onClick={() => void executePrompt()}>
                    Rename
                  </button>
                </>
              )}
              {promptMode === 'delete-selected' && (
                <>
                  <span style={{ color: '#ef4444', fontWeight: 500, fontSize: 12 }}>
                    Permanently delete {selectedPaths.size} selected items?
                  </span>
                  <button type="button" className={`${css.btn} ${css.btnDanger}`} onClick={() => void executePrompt()}>
                    Yes, Delete All
                  </button>
                </>
              )}
              {promptMode === 'delete-single' && (
                <>
                  <span style={{ color: '#ef4444', fontWeight: 500, fontSize: 12 }}>
                    Permanently delete <b>{promptTarget?.split('/').pop()}</b>?
                  </span>
                  <button type="button" className={`${css.btn} ${css.btnDanger}`} onClick={() => void executePrompt()}>
                    Yes, Delete
                  </button>
                </>
              )}
              <button type="button" className={css.btn} onClick={() => setPromptMode(null)}>
                Cancel
              </button>
            </div>
          )}

          {/* Directory Files Table */}
          <div className={css.body}>
            {filteredEntries.length === 0 ? (
              <div className={css.emptyDir}>
                {loading ? 'Scanning directory…' : 'This folder is empty'}
              </div>
            ) : (
              <table className={css.table}>
                <thead>
                  <tr>
                    <th style={{ width: 28, paddingLeft: 8, paddingRight: 0 }}></th>
                    <th>Name</th>
                    <th style={{ width: 55, textAlign: 'right', paddingRight: 4 }}>Size</th>
                    <th style={{ width: 34, textAlign: 'right', paddingRight: 8 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => {
                    const isSelected = selectedPaths.has(entry.path)
                    return (
                      <tr
                        key={entry.path}
                        className={`${css.tableRow} ${isSelected ? css.tableRowSelected : ''}`}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', `@${entry.path}`)
                          e.dataTransfer.setData('application/x-saddle-path', entry.path)
                          e.dataTransfer.effectAllowed = 'copy'
                        }}
                        onClick={(e) => {
                          // Prevent triggering if clicked directly on checkbox or action menu
                          if ((e.target as HTMLElement).closest('input') || (e.target as HTMLElement).closest(`.${css.itemActions}`)) {
                            return
                          }
                          if (entry.isDir) load(entry.path)
                          else openFile(entry.path)
                        }}
                      >
                        <td style={{ paddingLeft: 8, paddingRight: 0 }}>
                          <input
                            type="checkbox"
                            className={css.checkbox}
                            checked={isSelected}
                            onChange={() => toggleSelect(entry.path)}
                            onClick={e => e.stopPropagation()}
                          />
                        </td>
                        <td>
                          <div className={css.itemCol} title={entry.name}>
                            <span className={css.itemIcon}>{fileIcon(entry.name, entry.isDir)}</span>
                            <span className={`${css.itemName} ${entry.isDir ? css.dirName : ''}`}>
                              {entry.name}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', paddingRight: 4 }}>
                          <span className={css.itemSize}>
                            {entry.isDir ? '—' : formatSize(entry.sizeBytes)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', paddingRight: 8 }}>
                          <div className={css.itemActions} onClick={e => e.stopPropagation()}>
                            <Menu
                              open={openMenuPath === entry.path}
                              align="end"
                              portal
                              anchor={
                                <button
                                  type="button"
                                  className={css.actionDotsBtn}
                                  title="Actions"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOpenMenuPath(curr => (curr === entry.path ? null : entry.path))
                                  }}
                                >
                                  <IconEllipsisOutline16 size={13} />
                                </button>
                              }
                              items={[
                                {
                                  id: 'add-chat',
                                  label: 'Add to Chat',
                                  icon: <IconSendOutline14 size={14} />,
                                },
                                {
                                  id: 'copy-path',
                                  label: 'Copy Path',
                                  icon: <IconCopyOutline16 size={14} />,
                                },
                                {
                                  id: 'rename',
                                  label: 'Rename',
                                  icon: <IconEditOutline16 size={14} />,
                                },
                                {
                                  id: 'delete',
                                  label: 'Delete',
                                  danger: true,
                                  icon: <IconTrashOutline16 size={14} />,
                                },
                              ]}
                              onSelect={(id) => {
                                setOpenMenuPath(null)
                                if (id === 'add-chat') {
                                  addPathToChat(entry.path)
                                } else if (id === 'copy-path') {
                                  copyPathToClipboard(entry.path)
                                } else if (id === 'rename') {
                                  setPromptMode('rename')
                                  setPromptTarget(entry.path)
                                  setPromptInputText(entry.name)
                                } else if (id === 'delete') {
                                  setPromptMode('delete-single')
                                  setPromptTarget(entry.path)
                                }
                              }}
                              onClose={() => setOpenMenuPath(null)}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
