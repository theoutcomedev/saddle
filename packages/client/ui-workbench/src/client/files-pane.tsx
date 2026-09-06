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
  writeFile?: (path: string, content: string, encoding?: 'utf8' | 'base64') => Promise<{ path: string; bytesWritten: number }>
  deletePaths?: (paths: string[]) => Promise<{ deleted: string[] }>
  createFile?: (path: string, content?: string) => Promise<{ path: string }>
  renamePath?: (oldPath: string, newPath: string) => Promise<{ path: string }>
  createDirectory?: (path: string, name: string) => Promise<string>
  openPath: (path: string) => Promise<void>
}

/** Real-time progress tracking state for batch file and folder uploads. */
export interface UploadProgress {
  status: 'scanning' | 'uploading' | 'completed' | 'error'
  totalCount: number
  completedCount: number
  currentFileName: string
  error?: string
}

const TEXT_EXTS = new Set([
  'txt', 'md', 'markdown', 'json', 'js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'tsx', 'jsx',
  'css', 'scss', 'sass', 'less', 'html', 'htm', 'svg', 'xml', 'yaml', 'yml', 'toml',
  'ini', 'conf', 'config', 'env', 'sh', 'bash', 'zsh', 'py', 'rs', 'go', 'c', 'h',
  'cpp', 'hpp', 'java', 'sql', 'graphql', 'prisma', 'dockerfile', 'gitignore',
  'gitattributes', 'editorconfig', 'lock', 'csv', 'tsv', 'log', 'map',
])

function isTextFile(file: File): boolean {
  if (file.type.startsWith('text/')) return true
  if (file.type === 'application/json' || file.type === 'application/javascript' || file.type === 'application/typescript' || file.type === 'application/xml') return true
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  return TEXT_EXTS.has(ext)
}

async function readFilePayload(file: File): Promise<{ content: string; encoding: 'utf8' | 'base64' }> {
  if (isTextFile(file)) {
    const text = await file.text()
    return { content: text, encoding: 'utf8' }
  }
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const len = bytes.byteLength
  const chunkSize = 8192
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len))
    binary += String.fromCharCode(...chunk)
  }
  const content = btoa(binary)
  return { content, encoding: 'base64' }
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

/** Crisp, minimalist star SVG icon for pinned presets and favorites */
function IconStar({ size = 15, filled = true, className }: IconProps & { filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0.6 : 1.3}
      strokeLinejoin="round"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M8 1.75l1.87 3.79 4.18.61-3.03 2.95.72 4.16L8 11.3l-3.74 1.96.72-4.16-3.03-2.95 4.18-.61L8 1.75z" />
    </svg>
  )
}

/** Crisp arrow right-left icon for Move actions */
function IconArrowRightLeft({ size = 13, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M11 2.5l3 3-3 3" />
      <path d="M2 5.5h12" />
      <path d="M5 13.5l-3-3 3-3" />
      <path d="M14 10.5H2" />
    </svg>
  )
}

/** Crisp upload icon for file and folder uploads */
function IconUpload({ size = 13, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M8 10V2.5" />
      <path d="M4.5 6L8 2.5 11.5 6" />
      <path d="M2.5 10.5v2a1 1 0 001 1h9a1 1 0 001-1v-2" />
    </svg>
  )
}

/** Crisp eye-off icon for hidden files visibility toggle */
function IconEyeOffOutline16({ size = 14, className }: IconProps) {
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
        d="M2 2L14 14"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M6.5 3.3C6.98 3.17 7.48 3.1 8 3.1C11.5 3.1 14 5.5 15 8C14.53 9.17 13.68 10.24 12.56 11.02M9.62 12.64C9.1 12.81 8.56 12.9 8 12.9C4.5 12.9 2 10.5 1 8C1.56 6.6 2.65 5.33 4.02 4.48"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.65 6.65C6.24 7.03 6 7.48 6 8C6 9.1 6.9 10 8 10C8.52 10 8.97 9.76 9.35 9.35"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
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

  // Pane width tracking for responsive adaptations
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsNarrow(entry.contentRect.width < 460)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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

  // Inline Prompts (new file, new folder, rename, delete, move)
  type PromptMode = 'new-file' | 'new-folder' | 'rename' | 'delete-selected' | 'delete-single' | 'move-selected' | 'move-single'
  const [promptMode, setPromptMode] = useState<PromptMode | null>(null)
  const [promptTarget, setPromptTarget] = useState<string | null>(null)
  const [promptInputText, setPromptInputText] = useState('')
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [isDragOverDropZone, setIsDragOverDropZone] = useState(false)
  const dragDepthRef = useRef(0)

  // Folder dropdown state for move prompt
  const [showFolderDropdown, setShowFolderDropdown] = useState(false)
  const [folderSubdirs, setFolderSubdirs] = useState<WorkspaceFileEntry[]>([])
  const [loadingFolders, setLoadingFolders] = useState(false)
  const folderDropdownRef = useRef<HTMLDivElement | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)

  // File Viewer & Editor
  const [selectedFile, setSelectedFile] = useState<string | null>(initialPath === '' ? null : initialPath)
  const [originalText, setOriginalText] = useState('')
  const [editText, setEditText] = useState('')
  const [previewMode, setPreviewMode] = useState(true)
  const [wordWrap, setWordWrap] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveBanner, setSaveBanner] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const editorRef = useRef<HTMLTextAreaElement | null>(null)

  const isDirty = useMemo(() => selectedFile !== null && editText !== originalText, [selectedFile, editText, originalText])

  // Close folder dropdown when clicking outside
  useEffect(() => {
    if (!showFolderDropdown) return
    const handleClickOutside = (e: MouseEvent) => {
      if (folderDropdownRef.current && !folderDropdownRef.current.contains(e.target as Node)) {
        setShowFolderDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showFolderDropdown])

  // Fetch subdirectories for destination folder
  const loadFolderSubdirs = useCallback(async (targetPath: string) => {
    if (!targetPath) return
    setLoadingFolders(true)
    try {
      const res = await listFiles(targetPath)
      if (res && Array.isArray(res.entries)) {
        setFolderSubdirs(res.entries.filter(e => e.isDir))
      } else {
        setFolderSubdirs([])
      }
    } catch {
      setFolderSubdirs([])
    } finally {
      setLoadingFolders(false)
    }
  }, [listFiles])

  // When move prompt opens or prompt input changes, query subdirectories
  useEffect(() => {
    if (promptMode === 'move-selected' || promptMode === 'move-single') {
      const target = promptInputText.trim() || dir
      if (target.startsWith('/')) {
        void loadFolderSubdirs(target)
      }
    }
  }, [promptMode, promptInputText, dir, loadFolderSubdirs])

  const handleSelectDestFolder = (targetPath: string) => {
    setPromptInputText(targetPath)
    void loadFolderSubdirs(targetPath)
  }

  const renderDestinationSelector = () => {
    const currentTarget = promptInputText.trim() || dir
    const parent = parentPath(currentTarget)
    const hasParent = parent !== currentTarget && currentTarget !== '/'
    const filteredSubdirs = folderSubdirs.filter((f) => {
      if (selectedPaths.has(f.path)) return false
      if (promptMode === 'move-single' && promptTarget === f.path) return false
      return true
    })

    return (
      <div className={css.moveInputContainer} ref={folderDropdownRef}>
        <div className={css.moveInputWrapper}>
          <IconFolderClose16 size={13} className={css.moveFolderIcon} />
          <input
            type="text"
            className={css.moveInput}
            placeholder="Select or type destination path…"
            autoFocus
            value={promptInputText}
            onChange={(e) => {
              setPromptInputText(e.target.value)
              setShowFolderDropdown(true)
            }}
            onFocus={() => setShowFolderDropdown(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void executePrompt()
              if (e.key === 'Escape') {
                if (showFolderDropdown) setShowFolderDropdown(false)
                else setPromptMode(null)
              }
            }}
          />
          <button
            type="button"
            className={css.folderToggleBtn}
            onClick={() => setShowFolderDropdown(prev => !prev)}
            title="Browse destination folders"
          >
            <span style={{ fontSize: 9 }}>▼</span>
          </button>
        </div>

        {showFolderDropdown && (
          <div className={css.folderDropdown}>
            <div className={css.folderDropdownHeader}>
              <span>Available Destinations</span>
              {loadingFolders && <span>Loading…</span>}
            </div>

            {/* Navigate up to parent folder */}
            {hasParent && (
              <button
                type="button"
                className={`${css.folderDropdownItem} ${css.folderDropdownParent}`}
                onClick={() => handleSelectDestFolder(parent)}
                title={parent}
              >
                <span className={css.folderDropdownIcon}>⬆</span>
                <span className={css.folderDropdownName}>.. (Up to {parent.split('/').pop() || '/'})</span>
              </button>
            )}

            {/* Workspace root option if different */}
            {cwd && cwd !== currentTarget && (
              <button
                type="button"
                className={css.folderDropdownItem}
                onClick={() => handleSelectDestFolder(cwd)}
                title={cwd}
              >
                <span className={css.folderDropdownIcon}>🏠</span>
                <span className={css.folderDropdownName}>Workspace Root ({cwd.split('/').pop() || cwd})</span>
              </button>
            )}

            {/* Current viewing directory if different */}
            {dir !== currentTarget && (
              <button
                type="button"
                className={css.folderDropdownItem}
                onClick={() => handleSelectDestFolder(dir)}
                title={dir}
              >
                <span className={css.folderDropdownIcon}>📂</span>
                <span className={css.folderDropdownName}>Current Folder ({dir.split('/').pop() || dir})</span>
              </button>
            )}

            {/* Subfolders listing */}
            {filteredSubdirs.length > 0 ? (
              filteredSubdirs.map(f => (
                <button
                  type="button"
                  key={f.path}
                  className={css.folderDropdownItem}
                  onClick={() => handleSelectDestFolder(f.path)}
                  title={f.path}
                >
                  <span className={css.folderDropdownIcon}>📁</span>
                  <span className={css.folderDropdownName}>{f.name}</span>
                </button>
              ))
            ) : !loadingFolders ? (
              <div className={css.folderDropdownEmpty}>No subfolders in this location</div>
            ) : null}
          </div>
        )}
      </div>
    )
  }

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
      } else if (promptMode === 'move-selected') {
        const rawDest = promptInputText.trim()
        if (!rawDest) return
        const destDir = rawDest === '/' ? '/' : rawDest.replace(/\/+$/, '')
        if (renamePath && selectedPaths.size > 0) {
          for (const srcPath of selectedPaths) {
            const fileName = srcPath.split('/').filter(Boolean).pop() || ''
            if (fileName) {
              const target = destDir === '/' ? `/${fileName}` : `${destDir}/${fileName}`
              await renamePath(srcPath, target)
            }
          }
        }
        setSelectedPaths(new Set())
        setShowFolderDropdown(false)
        setPromptMode(null)
        load(dir)
      } else if (promptMode === 'move-single' && promptTarget) {
        const rawDest = promptInputText.trim()
        if (!rawDest) return
        const destDir = rawDest === '/' ? '/' : rawDest.replace(/\/+$/, '')
        if (renamePath) {
          const fileName = promptTarget.split('/').filter(Boolean).pop() || ''
          if (fileName) {
            const target = destDir === '/' ? `/${fileName}` : `${destDir}/${fileName}`
            await renamePath(promptTarget, target)
          }
        }
        if (selectedFile === promptTarget) {
          setSelectedFile(null)
        }
        setShowFolderDropdown(false)
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

  // Interfaces for standard FileSystemEntry web API
  interface DroppedFileEntry {
    isFile: true
    isDirectory: false
    name: string
    file: (successCallback: (file: File) => void, errorCallback?: (error: Error) => void) => void
  }
  interface DroppedDirReader {
    readEntries: (successCallback: (entries: DroppedEntry[]) => void, errorCallback?: (error: Error) => void) => void
  }
  interface DroppedDirEntry {
    isFile: false
    isDirectory: true
    name: string
    createReader: () => DroppedDirReader
  }
  type DroppedEntry = DroppedFileEntry | DroppedDirEntry

  // Helper: recursively traverse FileSystemEntry objects dropped from desktop
  const traverseEntry = async (entry: DroppedEntry, currentPath: string, fileList: Array<{ path: string; file: File }>): Promise<void> => {
    if (entry.isFile) {
      const file: File = await new Promise((resolve, reject) => {
        entry.file(resolve, reject)
      })
      fileList.push({ path: currentPath, file })
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader()
      const readAllEntries = async (): Promise<DroppedEntry[]> => {
        const result: DroppedEntry[] = []
        let batch = await new Promise<DroppedEntry[]>((resolve, reject) => {
          dirReader.readEntries(resolve, reject)
        })
        while (batch.length > 0) {
          result.push(...batch)
          batch = await new Promise<DroppedEntry[]>((resolve, reject) => {
            dirReader.readEntries(resolve, reject)
          })
        }
        return result
      }
      const children = await readAllEntries()
      for (const child of children) {
        await traverseEntry(child, `${currentPath}/${child.name}`, fileList)
      }
    }
  }

  // Upload handler for files (from input or drop items)
  const uploadFiles = async (source: FileList | File[] | DataTransferItemList) => {
    if (!writeFile) return
    setError(null)
    setUploadProgress({
      status: 'scanning',
      totalCount: 0,
      completedCount: 0,
      currentFileName: 'Scanning folder contents…',
    })
    try {
      const collected: Array<{ path: string; file: File }> = []
      const baseDir = dir.replace(/\/+$/, '')

      // Check if source is DataTransferItemList with webkitGetAsEntry (dropped folders/files)
      if ('length' in source && source.length > 0 && 'webkitGetAsEntry' in (source[0] as unknown as Record<string, unknown>)) {
        const items = Array.from(source as DataTransferItemList)
        for (const item of items) {
          if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry() as DroppedEntry | null
            if (entry) {
              await traverseEntry(entry, `${baseDir}/${entry.name}`, collected)
            } else {
              const file = item.getAsFile()
              if (file) collected.push({ path: `${baseDir}/${file.name}`, file })
            }
          }
        }
      } else {
        const files = Array.from(source as FileList | File[])
        for (const file of files) {
          const relPath = (file as { webkitRelativePath?: string }).webkitRelativePath || file.name
          collected.push({ path: `${baseDir}/${relPath.replace(/^\/+/, '')}`, file })
        }
      }

      if (collected.length === 0) {
        setUploadProgress(null)
        return
      }

      const firstItem = collected[0]
      setUploadProgress({
        status: 'uploading',
        totalCount: collected.length,
        completedCount: 0,
        currentFileName: firstItem?.file.name ?? '',
      })

      for (let i = 0; i < collected.length; i++) {
        const item = collected[i]
        if (!item) continue
        const { path: targetPath, file } = item
        setUploadProgress({
          status: 'uploading',
          totalCount: collected.length,
          completedCount: i,
          currentFileName: file.name,
        })
        const { content, encoding } = await readFilePayload(file)
        await writeFile(targetPath, content, encoding)
      }

      setUploadProgress({
        status: 'completed',
        totalCount: collected.length,
        completedCount: collected.length,
        currentFileName: '',
      })
      // Immediately reload directory listing to show uploaded items
      load(dir)
      setTimeout(() => setUploadProgress(null), 3500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setUploadProgress({
        status: 'error',
        totalCount: 0,
        completedCount: 0,
        currentFileName: '',
        error: msg,
      })
    }
  }

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    const parts = dir.split('/').filter(Boolean)
    const crumbs: { name: string; path: string }[] = [{ name: '..', path: '/' }]
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
    <div ref={rootRef} className={css.root}>
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
                  className={idx === 0 && crumb.name === '..'
                    ? css.crumbRoot
                    : `${css.crumb} ${idx === breadcrumbs.length - 1 ? css.crumbActive : ''}`}
                  onClick={() => load(crumb.path)}
                  title={idx === 0 && crumb.name === '..' ? 'Jump to parent / root folder' : crumb.path}
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
          aria-label={isCurrentDirPinned ? 'Unpin this folder' : 'Pin this folder'}
        >
          <IconStar size={15} filled={isCurrentDirPinned} />
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
                className={`${css.ghost} ${wordWrap ? css.wrapBtnActive : ''}`}
                title={wordWrap ? 'Disable text wrapping' : 'Enable text wrapping'}
                onClick={() => setWordWrap(!wordWrap)}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 4h10" />
                  <path d="M3 8h7a2.5 2.5 0 0 1 0 5H8" />
                  <path d="M10 11.5L8 13.5l2 2" />
                </svg>
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
              <span className={css.promptLabel} style={{ color: '#ef4444' }}>
                Permanently delete <b>{selectedFile.split('/').pop()}</b>?
              </span>
              <div className={css.promptActions}>
                <button type="button" className={`${css.btn} ${css.btnDanger}`} onClick={() => void executePrompt()}>
                  Yes, Delete
                </button>
                <button type="button" className={css.btn} onClick={() => setPromptMode(null)}>
                  Cancel
                </button>
              </div>
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
                <div style={{ padding: '16px 20px', overflowY: 'auto', height: '100%', userSelect: 'text', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                  <MarkdownText text={editText} />
                </div>
              )
            ) : (
              <textarea
                ref={editorRef}
                className={`${css.codeTextarea} ${!wordWrap ? css.codeTextareaNoWrap : ''}`}
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
        <div
          className={css.dropTarget}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}
          onDragEnter={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault()
              dragDepthRef.current += 1
              setIsDragOverDropZone(true)
            }
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'copy'
              if (!isDragOverDropZone) setIsDragOverDropZone(true)
            }
          }}
          onDragLeave={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault()
              dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
              if (dragDepthRef.current === 0) setIsDragOverDropZone(false)
            }
          }}
          onDrop={(e) => {
            e.preventDefault()
            dragDepthRef.current = 0
            setIsDragOverDropZone(false)
            if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
              void uploadFiles(e.dataTransfer.items)
            } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              void uploadFiles(e.dataTransfer.files)
            }
          }}
        >
          {isDragOverDropZone && (
            <div className={css.dropOverlay}>
              <IconUpload size={28} />
              <div className={css.dropTitle}>Drop files or folders to upload</div>
              <div className={css.dropSubtitle}>
                Uploading into <b>{dir === '/' ? '/ (root)' : dir.split('/').filter(Boolean).pop()}</b>
              </div>
            </div>
          )}
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
                  <span className={css.selectionPill} title={`${selectedPaths.size} selected`}>
                    <span className={css.selectionCount}>{selectedPaths.size}</span>
                    <span className={css.selectionLabel}> selected</span>
                  </span>
                  <button
                    type="button"
                    className={css.btn}
                    onClick={() => {
                      setPromptMode('move-selected')
                      setPromptInputText(dir)
                      setShowFolderDropdown(true)
                    }}
                    title={`Move ${selectedPaths.size} item(s)`}
                  >
                    <IconArrowRightLeft size={13} />
                    <span className={css.btnTextFull}>Move Selected</span>
                    <span className={css.btnTextShort}>Move</span>
                  </button>
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
                    className={css.clearBtn}
                    onClick={() => setSelectedPaths(new Set())}
                    title="Clear selection"
                  >
                    <span className={css.clearTextFull}>Clear</span>
                    <span className={css.clearTextShort}>✕</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={`${css.btn} ${css.btnCreate}`}
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
                    className={`${css.btn} ${css.btnCreate}`}
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
                  <button
                    type="button"
                    className={css.btn}
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload files to this folder"
                  >
                    <IconUpload size={13} />
                    <span className={css.btnTextFull}>Upload</span>
                    <span className={css.btnTextShort}>Upload</span>
                  </button>
                  {/* Hidden inputs for uploading files and directories */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        void uploadFiles(e.target.files)
                        e.target.value = ''
                      }
                    }}
                  />
                  <input
                    ref={folderInputRef}
                    type="file"
                    // @ts-expect-error webkitdirectory attribute is standard in browsers
                    webkitdirectory=""
                    directory=""
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        void uploadFiles(e.target.files)
                        e.target.value = ''
                      }
                    }}
                  />
                </>
              )}
            </div>

            <div className={`${css.actionGroup} ${css.actionGroupRight}`}>
              <input
                type="text"
                className={css.searchInput}
                placeholder={isNarrow ? 'Filter' : 'Filter files…'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button
                type="button"
                className={`${css.ghost} ${showHidden ? css.presetChipActive : ''}`}
                title={showHidden ? 'Hide hidden files (.dotfiles)' : 'Show hidden files (.dotfiles)'}
                aria-label={showHidden ? 'Hide hidden files' : 'Show hidden files'}
                onClick={() => setShowHidden(!showHidden)}
              >
                {showHidden ? <IconEyeOutline16 size={14} /> : <IconEyeOffOutline16 size={14} />}
              </button>
            </div>
          </div>

          {/* Upload Progress Banner */}
          {uploadProgress && (
            <div className={`${css.uploadBanner} ${uploadProgress.status === 'completed' ? css.uploadBannerSuccess : uploadProgress.status === 'error' ? css.uploadBannerError : ''}`}>
              <div className={css.uploadBannerMain}>
                <div className={css.uploadBannerIcon}>
                  {uploadProgress.status === 'completed' ? (
                    <IconCheckOutline16 size={14} className={css.successIcon} />
                  ) : uploadProgress.status === 'error' ? (
                    <IconCloseOutline16 size={14} className={css.errorIcon} />
                  ) : (
                    <span className={css.spinner} />
                  )}
                </div>
                <div className={css.uploadBannerInfo}>
                  <div className={css.uploadBannerTitle}>
                    {uploadProgress.status === 'scanning' && <span>Scanning files and folders…</span>}
                    {uploadProgress.status === 'uploading' && (
                      <>
                        <span>
                          Uploading {uploadProgress.completedCount + 1} of {uploadProgress.totalCount}:{' '}
                          <b>{uploadProgress.currentFileName}</b>
                        </span>
                        <span className={css.uploadBannerPercent}>
                          {Math.round((uploadProgress.completedCount / Math.max(uploadProgress.totalCount, 1)) * 100)}%
                        </span>
                      </>
                    )}
                    {uploadProgress.status === 'completed' && (
                      <span>
                        ✓ Uploaded {uploadProgress.totalCount} item{uploadProgress.totalCount === 1 ? '' : 's'} successfully
                      </span>
                    )}
                    {uploadProgress.status === 'error' && (
                      <span>Upload failed: {uploadProgress.error}</span>
                    )}
                  </div>
                  {uploadProgress.status === 'uploading' && (
                    <div className={css.progressBar}>
                      <div
                        className={css.progressFill}
                        style={{
                          width: `${Math.max(5, Math.round((uploadProgress.completedCount / Math.max(uploadProgress.totalCount, 1)) * 100))}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
                {(uploadProgress.status === 'completed' || uploadProgress.status === 'error') && (
                  <button
                    type="button"
                    className={css.ghost}
                    onClick={() => setUploadProgress(null)}
                    style={{ padding: 2, marginLeft: 'auto' }}
                    title="Dismiss"
                  >
                    <IconCloseOutline16 size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Inline Action Prompts */}
          {promptMode && (
            <div className={css.promptBar}>
              {promptMode === 'new-file' && (
                <>
                  <span className={css.promptLabel}>New File:</span>
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
                  <div className={css.promptActions}>
                    <button type="button" className={`${css.btn} ${css.btnPrimary}`} onClick={() => void executePrompt()}>
                      Create
                    </button>
                    <button type="button" className={css.btn} onClick={() => setPromptMode(null)}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
              {promptMode === 'new-folder' && (
                <>
                  <span className={css.promptLabel}>New Folder:</span>
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
                  <div className={css.promptActions}>
                    <button type="button" className={`${css.btn} ${css.btnPrimary}`} onClick={() => void executePrompt()}>
                      Create
                    </button>
                    <button type="button" className={css.btn} onClick={() => setPromptMode(null)}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
              {promptMode === 'rename' && (
                <>
                  <span className={css.promptLabel}>Rename:</span>
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
                  <div className={css.promptActions}>
                    <button type="button" className={`${css.btn} ${css.btnPrimary}`} onClick={() => void executePrompt()}>
                      Rename
                    </button>
                    <button type="button" className={css.btn} onClick={() => setPromptMode(null)}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
              {promptMode === 'move-selected' && (
                <>
                  <span className={css.promptLabel}>Move {selectedPaths.size} item(s) to:</span>
                  {renderDestinationSelector()}
                  <div className={css.promptActions}>
                    <button type="button" className={`${css.btn} ${css.btnPrimary}`} onClick={() => void executePrompt()}>
                      Move
                    </button>
                    <button
                      type="button"
                      className={css.btn}
                      onClick={() => {
                        setPromptMode(null)
                        setShowFolderDropdown(false)
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
              {promptMode === 'move-single' && (
                <>
                  <span className={css.promptLabel}>Move <b>{promptTarget?.split('/').pop()}</b> to:</span>
                  {renderDestinationSelector()}
                  <div className={css.promptActions}>
                    <button type="button" className={`${css.btn} ${css.btnPrimary}`} onClick={() => void executePrompt()}>
                      Move
                    </button>
                    <button
                      type="button"
                      className={css.btn}
                      onClick={() => {
                        setPromptMode(null)
                        setShowFolderDropdown(false)
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
              {promptMode === 'delete-selected' && (
                <>
                  <span className={css.promptLabel} style={{ color: '#ef4444' }}>
                    Permanently delete {selectedPaths.size} selected items?
                  </span>
                  <div className={css.promptActions}>
                    <button type="button" className={`${css.btn} ${css.btnDanger}`} onClick={() => void executePrompt()}>
                      Yes, Delete All
                    </button>
                    <button type="button" className={css.btn} onClick={() => setPromptMode(null)}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
              {promptMode === 'delete-single' && (
                <>
                  <span className={css.promptLabel} style={{ color: '#ef4444' }}>
                    Permanently delete <b>{promptTarget?.split('/').pop()}</b>?
                  </span>
                  <div className={css.promptActions}>
                    <button type="button" className={`${css.btn} ${css.btnDanger}`} onClick={() => void executePrompt()}>
                      Yes, Delete
                    </button>
                    <button type="button" className={css.btn} onClick={() => setPromptMode(null)}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
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
                    <th style={{ width: 30, paddingLeft: 10, paddingRight: 0 }}></th>
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
                          const paths = isSelected && selectedPaths.size > 1
                            ? Array.from(selectedPaths)
                            : [entry.path]
                          e.dataTransfer.setData('text/plain', paths.map(p => `@${p}`).join(' '))
                          e.dataTransfer.setData('application/x-saddle-path', entry.path)
                          e.dataTransfer.setData('application/x-saddle-paths', JSON.stringify(paths))
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
                        <td style={{ paddingLeft: 10, paddingRight: 0 }}>
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
                                  id: 'move',
                                  label: 'Move to…',
                                  icon: <IconArrowRightLeft size={13} />,
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
                                } else if (id === 'move') {
                                  setPromptMode('move-single')
                                  setPromptTarget(entry.path)
                                  setPromptInputText(dir)
                                  setShowFolderDropdown(true)
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
