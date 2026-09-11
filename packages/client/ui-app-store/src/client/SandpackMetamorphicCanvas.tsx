/**
 * SandpackMetamorphicCanvas: The live, isolated browser runtime for agent-mounted metamorphic apps.
 * Compiles and executes arbitrary React/TypeScript/Tailwind applications inside Sandpack.
 */

import { useState, useEffect, useMemo } from 'react'
import {
  SandpackProvider,
  SandpackPreview,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackFileExplorer,
} from '@codesandbox/sandpack-react'
import {
  IconEyeOutline16,
  IconCodeOutline16,
  IconRefreshOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import css from './SandpackMetamorphicCanvas.module.css'

export interface SandpackMetamorphicCanvasProps {
  title?: string | undefined
  description?: string | undefined
  files?: Record<string, string> | undefined
  dependencies?: Record<string, string> | undefined
  template?: ('react-ts' | 'react' | 'vanilla') | undefined
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

const DEFAULT_FILES: Record<string, string> = {
  '/App.tsx': `import React, { useState } from 'react';
import { Sparkles, Activity } from 'lucide-react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Saddle Metamorphic OS</h1>
            <p className="text-xs text-slate-400">Live Sandpack Canvas</p>
          </div>
        </div>

        <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-800 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">Status</span>
            <span className="inline-flex items-center text-emerald-400 font-medium text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-ping" />
              Interactive & Isolated
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">Interactions</span>
            <span className="font-semibold text-slate-200">{count} clicks</span>
          </div>
        </div>

        <button
          onClick={() => setCount(c => c + 1)}
          className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-semibold rounded-xl transition duration-150 shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2"
        >
          <Activity className="w-4 h-4" />
          <span>Trigger State Mutation</span>
        </button>
      </div>
    </div>
  );
}
`,
}

export function SandpackMetamorphicCanvas({
  title = 'Metamorphic App',
  files = DEFAULT_FILES,
  dependencies,
  template = 'react-ts',
  isMaximized: controlledMaximized,
  onToggleMaximize,
}: SandpackMetamorphicCanvasProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview')
  const [internalMaximized, setInternalMaximized] = useState(false)
  const [sandpackKey, setSandpackKey] = useState(0)

  const isMax = controlledMaximized !== undefined ? controlledMaximized : internalMaximized
  const handleToggleMax = onToggleMaximize || (() => setInternalMaximized(prev => !prev))

  useEffect(() => {
    if (!isMax) return
    document.body.setAttribute('data-notepad-maximized', 'true')

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleToggleMax()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.removeAttribute('data-notepad-maximized')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isMax, handleToggleMax])

  useEffect(() => {
    return () => {
      document.body.removeAttribute('data-notepad-maximized')
    }
  }, [])

  // Prepare normalized virtual files
  const normalizedFiles = useMemo(() => {
    const res: Record<string, string> = {}
    const entries = Object.entries(files || {})
    if (entries.length === 0) {
      return DEFAULT_FILES
    }
    for (const [rawPath, code] of entries) {
      const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
      res[path] = code
    }
    return res
  }, [files])

  // Custom dependencies with common primitives preloaded
  const customDependencies = useMemo(() => {
    return {
      'lucide-react': '^0.454.0',
      'clsx': '^2.1.1',
      ...(dependencies || {}),
    }
  }, [dependencies])

  // Detect theme from document body
  const isDarkTheme = typeof document !== 'undefined'
    ? document.body.getAttribute('data-theme') === 'dark' || !document.body.getAttribute('data-theme')
    : true

  return (
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
              <span>Preview</span>
            </button>
            <button
              type="button"
              className={`${css.segmentBtn} ${activeTab === 'code' ? css.segmentBtnActive : ''}`}
              onClick={() => setActiveTab('code')}
              title="Inspect Virtual Source Code"
            >
              <IconCodeOutline16 size={13} />
              <span>Code</span>
            </button>
          </div>

          <button
            type="button"
            className={css.iconBtn}
            onClick={() => setSandpackKey(k => k + 1)}
            title="Reload Sandbox"
            aria-label="Reload Sandbox"
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
        </div>
      </div>

      <div className={css.canvasBody}>
        <SandpackProvider
          key={sandpackKey}
          template={template}
          theme={isDarkTheme ? 'dark' : 'light'}
          files={normalizedFiles}
          customSetup={{
            dependencies: customDependencies,
          }}
          options={{
            externalResources: [
              'https://cdn.tailwindcss.com',
            ],
            recompileMode: 'immediate',
            recompileDelay: 200,
          }}
        >
          {activeTab === 'preview' ? (
            <SandpackPreview
              showOpenInCodeSandbox={false}
              showRefreshButton={false}
              style={{ height: '100%', width: '100%', border: 'none' }}
            />
          ) : (
            <SandpackLayout style={{ height: '100%', width: '100%' }}>
              <SandpackFileExplorer style={{ height: '100%' }} />
              <SandpackCodeEditor
                showLineNumbers
                showInlineErrors
                style={{ height: '100%' }}
              />
            </SandpackLayout>
          )}
        </SandpackProvider>
      </div>
    </div>
  )
}
