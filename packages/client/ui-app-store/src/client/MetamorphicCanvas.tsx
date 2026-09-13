/**
 * MetamorphicCanvas: the Workbench dock's host for an agent-mounted app.
 *
 * The compile-and-run contract lives in ui-primitives' metamorphic runtime,
 * which the chat card uses too; this component owns only the toolbar, the
 * sandboxed iframe, and the source view.
 */

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  buildMetamorphicSrcDoc,
  METAMORPHIC_SANDBOX,
  IconEyeOutline16,
  IconCodeOutline16,
  IconRefreshOutline16,
  IconCloseOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import css from './MetamorphicCanvas.module.css'

export interface MetamorphicCanvasProps {
  title?: string | undefined
  description?: string | undefined
  files?: Record<string, string> | undefined
  entryFile?: string | undefined
  isMaximized?: boolean | undefined
  onToggleMaximize?: (() => void) | undefined
}

function LocalFullscreenIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 5.5V3.5C1.5 2.4 2.4 1.5 3.5 1.5H5.5M10.5 1.5H12.5C13.6 1.5 14.5 2.4 14.5 3.5V5.5M14.5 10.5V12.5C14.5 13.6 13.6 14.5 12.5 14.5H10.5M5.5 14.5H3.5C2.4 14.5 1.5 13.6 1.5 12.5V10.5" />
    </svg>
  )
}

function LocalMinimizeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 1.5V3.5C5.5 4.6 4.6 5.5 3.5 5.5H1.5M10.5 5.5H12.5C11.4 5.5 10.5 4.6 10.5 3.5V1.5M14.5 10.5H12.5C11.4 10.5 10.5 11.4 10.5 12.5V14.5M1.5 10.5H3.5C4.6 10.5 5.5 11.4 5.5 12.5V14.5" />
    </svg>
  )
}

export function MetamorphicCanvas({
  title = 'Metamorphic App',
  files = {},
  entryFile = '/App.tsx',
  isMaximized: controlledMaximized,
  onToggleMaximize,
}: MetamorphicCanvasProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview')
  const [internalMaximized, setInternalMaximized] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const isMax = controlledMaximized !== undefined ? controlledMaximized : internalMaximized
  const handleToggleMax = onToggleMaximize || (() => setInternalMaximized(prev => !prev))

  useEffect(() => {
    if (!isMax) return
    // The dock's maximize contract is body-scoped, and the stylesheet keys off
    // the attribute the notepad app introduced.
    document.body.setAttribute('data-notepad-maximized', 'true')
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleToggleMax()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.removeAttribute('data-notepad-maximized')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isMax, handleToggleMax])

  useEffect(() => () => { document.body.removeAttribute('data-notepad-maximized') }, [])

  /** Every mounted path is absolute, so the source view and the runtime agree. */
  const normalizedFiles = useMemo(() => {
    const res: Record<string, string> = {}
    for (const [rawPath, code] of Object.entries(files ?? {})) {
      res[rawPath.startsWith('/') ? rawPath : `/${rawPath}`] = code
    }
    return res
  }, [files])

  const fileKeys = useMemo(() => Object.keys(normalizedFiles), [normalizedFiles])
  const [selectedFile, setSelectedFile] = useState<string>(fileKeys[0] ?? entryFile)

  useEffect(() => {
    if (normalizedFiles[selectedFile] === undefined) setSelectedFile(fileKeys[0] ?? entryFile)
  }, [entryFile, fileKeys, normalizedFiles, selectedFile])

  const srcDoc = useMemo(
    () => buildMetamorphicSrcDoc(normalizedFiles, entryFile, title),
    [normalizedFiles, entryFile, title, reloadKey],
  )

  const element = (
    <div className={`${css.root} ${isMax ? css.maximized : ''}`}>
      <div className={css.toolbar}>
        <div className={css.toolbarLeft}>
          <span className={css.liveBadge}>
            <span className={css.liveDot} />
            Live
          </span>
          <span className={css.title} title={title}>
            {title}
          </span>
        </div>

        <div className={css.toolbarRight}>
          <div className={css.segmentedGroup}>
            <button
              type="button"
              className={`${css.segmentBtn} ${activeTab === 'preview' ? css.segmentBtnActive : ''}`}
              onClick={() => setActiveTab('preview')}
              title="Live App View"
            >
              <IconEyeOutline16 size={13} />
              <span className={css.btnText}>Preview</span>
            </button>
            <button
              type="button"
              className={`${css.segmentBtn} ${activeTab === 'code' ? css.segmentBtnActive : ''}`}
              onClick={() => setActiveTab('code')}
              title="Inspect Virtual Source Code"
            >
              <IconCodeOutline16 size={13} />
              <span className={css.btnText}>Code</span>
            </button>
          </div>

          <button
            type="button"
            className={css.iconBtn}
            onClick={() => setReloadKey(k => k + 1)}
            title="Reload App"
            aria-label="Reload App"
          >
            <IconRefreshOutline16 size={14} />
          </button>

          <button
            type="button"
            className={css.iconBtn}
            onClick={handleToggleMax}
            title={isMax ? 'Restore View (Esc)' : 'Maximize in Workbench'}
            aria-label={isMax ? 'Restore View' : 'Maximize in Workbench'}
          >
            {isMax ? <LocalMinimizeIcon size={14} /> : <LocalFullscreenIcon size={14} />}
          </button>

          {isMax && (
            <button
              type="button"
              className={css.closeBtn}
              onClick={handleToggleMax}
              title="Close Fullscreen (Esc)"
              aria-label="Close Fullscreen"
            >
              <IconCloseOutline16 size={16} />
            </button>
          )}
        </div>
      </div>

      <div className={css.canvasBody}>
        {activeTab === 'preview' ? (
          <iframe
            key={reloadKey}
            className={css.runnerIframe}
            srcDoc={srcDoc}
            title={title}
            sandbox={METAMORPHIC_SANDBOX}
          />
        ) : (
          <div className={css.codeLayout}>
            {fileKeys.length > 1 && (
              <>
                <div className={css.fileSidebar}>
                  <div className={css.fileSidebarTitle}>Files ({fileKeys.length})</div>
                  <div className={css.fileList}>
                    {fileKeys.map(f => (
                      <button
                        key={f}
                        type="button"
                        className={`${css.fileItem} ${f === selectedFile ? css.fileItemActive : ''}`}
                        onClick={() => setSelectedFile(f)}
                        title={f}
                      >
                        {f.replace(/^\//, '')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={css.mobileFileBar}>
                  <span className={css.mobileFileLabel}>File:</span>
                  <select
                    className={css.mobileFileSelect}
                    value={selectedFile}
                    onChange={e => setSelectedFile(e.target.value)}
                  >
                    {fileKeys.map(f => (
                      <option key={f} value={f}>
                        {f.replace(/^\//, '')}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div className={css.editorArea}>
              <pre className={css.editorPre}>
                <code>{normalizedFiles[selectedFile] ?? ''}</code>
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  if (isMax && typeof document !== 'undefined') return createPortal(element, document.body)
  return element
}
