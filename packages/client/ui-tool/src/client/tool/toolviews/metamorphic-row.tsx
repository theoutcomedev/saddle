/**
 * Metamorphic app toolview: the keyed toolview hole for the `mount_app` tool.
 * Renders an interactive live app card inside chat with live Sandpack execution,
 * inline preview toggle, and one-click docking into the Workbench column.
 */

import { useState, useMemo, useEffect } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import {
  IconEyeOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ToolCallViewProps } from '../../contract/slots.ts'
import { CONVERSATION_NS as NS } from '../../locale.ts'
import css from './metamorphic-row.module.css'

function buildMetamorphicSrcDoc(
  files: Record<string, string>,
  entryFile = '/App.tsx',
  title = 'Metamorphic App',
): string {
  if (files['/index.html'] || files['index.html']) {
    return files['/index.html'] || files['index.html'] || ''
  }

  let entryCode = files[entryFile] || files['/App.tsx'] || files['/App.jsx'] || files['/App.js'] || files['/index.tsx'] || ''
  if (!entryCode) {
    const keys = Object.keys(files)
    const firstKey = keys[0]
    if (firstKey !== undefined && files[firstKey] !== undefined) {
      entryCode = files[firstKey]
    }
  }

  let secondaryModules = ''
  for (const [path, code] of Object.entries(files)) {
    if (path === entryFile || path === '/App.tsx' || path === '/App.jsx' || path === '/App.js' || path === '/index.tsx' || path === '/index.html') {
      continue
    }
    if (path.endsWith('.tsx') || path.endsWith('.ts') || path.endsWith('.jsx') || path.endsWith('.js')) {
      secondaryModules += `\n// File: ${path}\nwindow.__saddle_modules = window.__saddle_modules || {};\n(function(){\nconst exports = {}; const module = { exports };\n${code}\nwindow.__saddle_modules['${path}'] = module.exports || exports;\n})();\n`
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
              400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
            }
          }
        }
      }
    };
  </script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow-x: hidden;
      background: #090d16;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    #root {
      min-height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column;
    }
    .error-container {
      padding: 24px;
      margin: 20px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 12px;
      color: #fca5a5;
      font-family: ui-monospace, monospace;
      font-size: 13px;
    }
    .error-title {
      font-weight: bold;
      color: #ef4444;
      margin-bottom: 8px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div id="root"></div>

  <script>
    window.React = window.React || React;
    window.ReactDOM = window.ReactDOM || ReactDOM;

    window.createLucideShim = function(iconName) {
      return function LucideIcon(props) {
        const { size = 20, color = 'currentColor', className = '', strokeWidth = 2, ...rest } = props || {};
        const iconDef = window.lucide && window.lucide.icons && (window.lucide.icons[iconName] || window.lucide.icons[iconName.toLowerCase()]);
        if (!iconDef) {
          return React.createElement('svg', {
            width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color,
            strokeWidth: strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
            className: className, ...rest
          }, React.createElement('circle', { cx: 12, cy: 12, r: 8 }));
        }
        const children = (iconDef[2] || []).map(function(item, idx) {
          return React.createElement(item[0], Object.assign({ key: idx }, item[1]));
        });
        return React.createElement('svg', Object.assign({
          width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color,
          strokeWidth: strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
          className: className,
        }, iconDef[1], rest), children);
      };
    };

    window.__lucideProxy = new Proxy({}, {
      get: function(target, prop) {
        if (typeof prop !== 'string') return undefined;
        return window.createLucideShim(prop);
      }
    });

    window.onerror = function(msg, url, line, col, err) {
      const root = document.getElementById('root');
      if (root) {
        root.innerHTML = '<div class="error-container">' +
          '<div class="error-title">Runtime Error</div>' +
          '<div>' + (msg || err) + '</div>' +
          (line ? '<div style="margin-top:6px; color:#94a3b8; font-size:11px;">Line: ' + line + ', Column: ' + col + '</div>' : '') +
          '</div>';
      }
    };
  </script>

  <script type="text/babel" data-type="module" data-presets="react,typescript">
    ${secondaryModules}

    const React = window.React;
    const { useState, useEffect, useMemo, useRef, useCallback, useReducer, useContext } = React;
    const LucideIcons = window.__lucideProxy;
    const lucideReact = window.__lucideProxy;

    class MetamorphicErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
      }
      static getDerivedStateFromError(error) {
        return { hasError: true, error: error };
      }
      componentDidCatch(error, errorInfo) {
        console.error("Metamorphic App Error:", error, errorInfo);
      }
      render() {
        if (this.state.hasError) {
          return React.createElement('div', { className: 'error-container' },
            React.createElement('div', { className: 'error-title' }, 'Application Error'),
            React.createElement('div', null, (this.state.error && this.state.error.message) || String(this.state.error)),
            React.createElement('div', { style: { marginTop: '12px' } },
              React.createElement('button', {
                className: 'px-3 py-1.5 bg-red-500/20 text-red-300 rounded border border-red-500/30 text-xs font-semibold hover:bg-red-500/30',
                onClick: () => this.setState({ hasError: false, error: null })
              }, 'Retry Execution')
            )
          );
        }
        return this.props.children;
      }
    }

    try {
      let processedCode = ${JSON.stringify(entryCode)};

      processedCode = processedCode.replace(/import\\s+\\{([^}]+)\\}\\s+from\\s+['"]lucide-react['"];?/g, 'const { $1 } = window.__lucideProxy;');
      processedCode = processedCode.replace(/import\\s+\\*\\s+as\\s+([a-zA-Z0-9_$]+)\\s+from\\s+['"]lucide-react['"];?/g, 'const $1 = window.__lucideProxy;');

      processedCode = processedCode.replace(/import\\s+React\\s*(?:,\\s*\\{([^}]+)\\})?\\s*from\\s+['"]react['"];?/g, (m, g1) => {
        return g1 ? 'const { ' + g1 + ' } = React;' : '';
      });
      processedCode = processedCode.replace(/import\\s+\\{([^}]+)\\}\\s+from\\s+['"]react['"];?/g, 'const { $1 } = React;');

      processedCode = processedCode.replace(/import\\s+['"][^'"]+\\.css['"];?/g, '');

      let hasDefaultExport = false;
      if (/export\\s+default\\s+function\\s+([a-zA-Z0-9_$]+)/.test(processedCode)) {
        processedCode = processedCode.replace(/export\\s+default\\s+function\\s+([a-zA-Z0-9_$]+)/, 'function $1');
        hasDefaultExport = true;
      } else if (/export\\s+default\\s+([a-zA-Z0-9_$]+)/.test(processedCode)) {
        processedCode = processedCode.replace(/export\\s+default\\s+([a-zA-Z0-9_$]+)/, '/* export default $1 */');
        hasDefaultExport = true;
      }

      const evaluateModule = new Function(
        'React', 'useState', 'useEffect', 'useMemo', 'useRef', 'useCallback', 'LucideIcons',
        processedCode + '; return typeof App !== "undefined" ? App : (typeof defaultExport !== "undefined" ? defaultExport : null);'
      );

      const AppComponent = evaluateModule(React, useState, useEffect, useMemo, useRef, useCallback, LucideIcons);

      if (AppComponent) {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(
          React.createElement(MetamorphicErrorBoundary, null,
            React.createElement(AppComponent)
          )
        );
      } else {
        document.getElementById('root').innerHTML = '<div class="error-container"><div class="error-title">No App Component Exported</div><div>Please export a default App component in /App.tsx.</div></div>';
      }
    } catch (err) {
      console.error("Compilation error:", err);
      document.getElementById('root').innerHTML = '<div class="error-container">' +
        '<div class="error-title">Compilation Error</div>' +
        '<div>' + (err.message || String(err)) + '</div>' +
        '</div>';
    }
  </script>
</body>
</html>`
}

function IconDock({ size = 13 }: { size?: number }) {
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
    >
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" />
      <path d="M8.5 1.5H12.5C13.6 1.5 14.5 2.4 14.5 3.5V12.5C14.5 13.6 13.6 14.5 12.5 14.5H8.5V1.5Z" fill="currentColor" />
    </svg>
  )
}

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
    if (argsRaw) {
      const parsed: unknown = JSON.parse(argsRaw)
      if (parsed && typeof parsed === 'object') {
        parsedArgs = parsed as Record<string, unknown>
      }
    }
  } catch {}

  const presentationMeta = done ? (block as unknown as { presentationMeta?: Record<string, unknown> }).presentationMeta : undefined
  const meta = presentationMeta || parsedArgs

  const title = typeof meta.title === 'string' ? meta.title : 'Metamorphic App'
  const description = typeof meta.description === 'string' ? meta.description : 'Interactive live application'
  const template = meta.template === 'react' || meta.template === 'vanilla' ? meta.template : 'react-ts'
  const entryFile = typeof meta.entryFile === 'string' ? meta.entryFile : '/App.tsx'
  const rawFiles = meta.files && typeof meta.files === 'object' ? (meta.files as Record<string, string>) : {}
  const dependencies = meta.dependencies && typeof meta.dependencies === 'object' ? (meta.dependencies as Record<string, string>) : {}

  // Normalize files
  const files = useMemo(() => {
    const res: Record<string, string> = {}
    for (const [key, val] of Object.entries(rawFiles)) {
      const path = key.startsWith('/') ? key : `/${key}`
      res[path] = typeof val === 'string' ? val : JSON.stringify(val)
    }
    return res
  }, [rawFiles])

  const fileCount = Object.keys(files).length

  // Generate srcDoc for inline preview
  const srcDoc = useMemo(() => {
    if (fileCount === 0) return ''
    return buildMetamorphicSrcDoc(files, entryFile, title)
  }, [files, entryFile, title, fileCount])

  // Automatically dock into workbench on first mount if target === 'workbench'
  useEffect(() => {
    const target = meta.target || parsedArgs.target || 'workbench'
    if (target === 'workbench' && fileCount > 0) {
      window.dispatchEvent(new CustomEvent('workbench:open-app', {
        detail: {
          appId: 'metamorphic',
          title,
          icon: '✨',
          params: { title, description, files, dependencies, template, entryFile },
        },
      }))
    }
  }, [fileCount, title, description, files, dependencies, template, entryFile, meta.target, parsedArgs.target])

  const handleDockInWorkbench = () => {
    window.dispatchEvent(new CustomEvent('workbench:open-app', {
      detail: {
        appId: 'metamorphic',
        title,
        icon: '✨',
        params: { title, description, files, dependencies, template, entryFile },
      },
    }))
  }

  const handleFullscreen = () => {
    window.dispatchEvent(new CustomEvent('saddle:open-fullscreen-app', {
      detail: {
        appId: 'metamorphic',
        params: { title, description, files, dependencies, template, entryFile },
      },
    }))
  }

  return (
    <div className={css.card}>
      <div className={css.header}>
        <div className={css.headerLeft}>
          <div className={css.sparkleIcon}>✨</div>
          <div className={css.titleArea}>
            <span className={css.title} title={title}>{title}</span>
            <span className={css.subtitle}>
              {fileCount > 0 ? `${fileCount} files` : 'Initializing app'} • Zero-Latency Isolated Runtime
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
            <IconDock size={13} />
            <span className={css.btnText}>Dock</span>
          </button>

          <button
            type="button"
            className={css.actionBtn}
            onClick={handleFullscreen}
            title="Open in Fullscreen"
          >
            <LocalFullscreenIcon size={13} />
            <span className={css.btnText}>Fullscreen</span>
          </button>

          {fileCount > 0 && (
            <button
              type="button"
              className={`${css.actionBtn} ${showInlinePreview ? css.actionBtnActive : ''}`}
              onClick={() => {
                setShowInlinePreview(!showInlinePreview)
              }}
              title={showInlinePreview ? 'Hide Inline Preview' : 'Show Inline Preview'}
            >
              <IconEyeOutline16 size={13} />
              <span className={css.btnText}>{showInlinePreview ? 'Hide' : 'Preview'}</span>
            </button>
          )}
        </div>
      </div>

      {showInlinePreview && fileCount > 0 && (
        <div className={css.previewContainer}>
          <iframe
            className={css.runnerIframe}
            srcDoc={srcDoc}
            title={title}
            sandbox="allow-scripts allow-modals allow-same-origin"
          />
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
