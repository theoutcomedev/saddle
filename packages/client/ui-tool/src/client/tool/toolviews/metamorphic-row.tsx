/**
 * Metamorphic app toolview: the keyed toolview hole for the `mount_app` tool.
 * Renders an interactive live app card inside chat with live Sandpack execution,
 * inline preview toggle, and one-click docking into the Workbench column.
 */

import { useState, useMemo, useEffect } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import {
  SandpackProvider,
  SandpackPreview,
} from '@codesandbox/sandpack-react'
import {
  IconEyeOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ToolCallViewProps } from '../../contract/slots.ts'
import { CONVERSATION_NS as NS } from '../../locale.ts'
import css from './metamorphic-row.module.css'

function LocalFullscreenIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 5.5V3.5C1.5 2.4 2.4 1.5 3.5 1.5H5.5M10.5 1.5H12.5C13.6 1.5 14.5 2.4 14.5 3.5V5.5M14.5 10.5V12.5C14.5 13.6 13.6 14.5 12.5 14.5H10.5M5.5 14.5H3.5C2.4 14.5 1.5 13.6 1.5 12.5V10.5" />
    </svg>
  )
}

export function MetamorphicRow({ block }: ToolCallViewProps) {
  const [showInlinePreview, setShowInlinePreview] = useState(true)

  // Discriminate RunningToolCall vs ToolResultNode
  const done = 'kind' in block
  const argsRaw = (done ? block.call?.argsRaw : block.argsRaw) ?? ''

  let parsedArgs: Record<string, unknown> = {}
  try {
    if (argsRaw) parsedArgs = JSON.parse(argsRaw)
  } catch {}

  const presentationMeta = done ? (block as unknown as { presentationMeta?: Record<string, unknown> }).presentationMeta : undefined
  const meta = (presentationMeta || parsedArgs) as Record<string, unknown>

  const title = String(meta.title || parsedArgs.title || 'Metamorphic App')
  const description = String(meta.description || parsedArgs.description || 'Interactive live application')
  const template = ((meta.template || parsedArgs.template) as 'react-ts' | 'react' | 'vanilla') || 'react-ts'
  const rawFiles = (meta.files || parsedArgs.files || {}) as Record<string, string>
  const dependencies = (meta.dependencies || parsedArgs.dependencies || {}) as Record<string, string>

  // Normalize files
  const files = useMemo(() => {
    const res: Record<string, string> = {}
    for (const [key, val] of Object.entries(rawFiles)) {
      const path = key.startsWith('/') ? key : `/${key}`
      res[path] = String(val)
    }
    return res
  }, [rawFiles])

  const fileCount = Object.keys(files).length

  // Automatically dock into workbench on first mount if target === 'workbench'
  useEffect(() => {
    const target = meta.target || parsedArgs.target || 'workbench'
    if (target === 'workbench' && fileCount > 0) {
      window.dispatchEvent(new CustomEvent('workbench:open-app', {
        detail: {
          appId: 'metamorphic',
          title,
          icon: '✨',
          params: { title, description, files, dependencies, template },
        },
      }))
    }
  }, [fileCount, title, description, files, dependencies, template, meta.target, parsedArgs.target])

  const handleDockInWorkbench = () => {
    window.dispatchEvent(new CustomEvent('workbench:open-app', {
      detail: {
        appId: 'metamorphic',
        title,
        icon: '✨',
        params: { title, description, files, dependencies, template },
      },
    }))
  }

  const handleFullscreen = () => {
    window.dispatchEvent(new CustomEvent('saddle:open-fullscreen-app', {
      detail: { appId: 'metamorphic' },
    }))
  }

  const isDarkTheme = typeof document !== 'undefined'
    ? document.body.getAttribute('data-theme') === 'dark' || !document.body.getAttribute('data-theme')
    : true

  return (
    <div className={css.card}>
      <div className={css.header}>
        <div className={css.headerLeft}>
          <div className={css.sparkleIcon}>✨</div>
          <div className={css.titleArea}>
            <span className={css.title} title={title}>{title}</span>
            <span className={css.subtitle}>
              {fileCount > 0 ? `${fileCount} files` : 'Initializing app'} • Sandpack Isolated Runtime
            </span>
          </div>
        </div>

        <div className={css.headerRight}>
          <button
            type="button"
            className={css.actionBtn}
            onClick={handleDockInWorkbench}
            title="Dock application into Workbench"
          >
            <span>📱 Dock in Workbench</span>
          </button>

          <button
            type="button"
            className={css.actionBtn}
            onClick={handleFullscreen}
            title="Open in Fullscreen"
          >
            <LocalFullscreenIcon size={13} />
            <span>Fullscreen</span>
          </button>

          {fileCount > 0 && (
            <button
              type="button"
              className={`${css.actionBtn} ${showInlinePreview ? css.actionBtnActive : ''}`}
              onClick={() => setShowInlinePreview(!showInlinePreview)}
              title={showInlinePreview ? 'Hide Inline Preview' : 'Show Inline Preview'}
            >
              <IconEyeOutline16 size={13} />
              <span>{showInlinePreview ? 'Hide Preview' : 'View'}</span>
            </button>
          )}
        </div>
      </div>

      {showInlinePreview && fileCount > 0 && (
        <div className={css.previewContainer}>
          <SandpackProvider
            template={template}
            theme={isDarkTheme ? 'dark' : 'light'}
            files={files}
            customSetup={{
              dependencies: {
                'lucide-react': '^0.454.0',
                ...dependencies,
              },
            }}
            options={{
              externalResources: [
                'https://cdn.tailwindcss.com',
              ],
              recompileMode: 'immediate',
              recompileDelay: 200,
            }}
          >
            <SandpackPreview
              showOpenInCodeSandbox={false}
              showRefreshButton={false}
              style={{ height: '100%', width: '100%', border: 'none' }}
            />
          </SandpackProvider>
        </div>
      )}
    </div>
  )
}

export const metamorphicToolview = {
  name: 'metamorphic-toolview',
  inject: ['slots'],
  apply(ctx: Context): void {
    ctx.slots.inject('tool.call.toolview', function* () {
      yield ctx.slots.register({ name: 'tool.call.toolview', key: 'mount_app', locale: NS }, MetamorphicRow)
    })
  },
}
