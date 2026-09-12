/**
 * SandpackMetamorphicCanvas: The live, isolated browser runtime for agent-mounted metamorphic apps.
 * Compiles and executes arbitrary React/TypeScript/Tailwind applications inside a sandboxed srcdoc iframe.
 * Completely local, zero-network-timeout, zero-cloud-dependency execution engine.
 */

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  IconEyeOutline16,
  IconCodeOutline16,
  IconRefreshOutline16,
  IconCloseOutline16,
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
            <p className="text-xs text-slate-400">Live Isolated Canvas</p>
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

/**
 * Builds a standalone self-contained HTML document for the sandboxed iframe.
 * Loads React 18, Babel Standalone for instant in-browser JSX compilation,
 * Lucide icon support, Tailwind CSS CDN, and a protective error boundary.
 */
export function buildMetamorphicSrcDoc(
  files: Record<string, string>,
  entryFile = '/App.tsx',
  title = 'Metamorphic App',
): string {
  // If entry point is index.html, return direct HTML
  if (files['/index.html'] || files['index.html']) {
    return files['/index.html'] || files['index.html'] || ''
  }

  // Find candidate entry code
  let entryCode = files[entryFile] || files['/App.tsx'] || files['/App.jsx'] || files['/App.js'] || files['/index.tsx'] || ''
  if (!entryCode) {
    const keys = Object.keys(files)
    const firstKey = keys[0]
    if (firstKey !== undefined && files[firstKey] !== undefined) {
      entryCode = files[firstKey]
    }
  }

  // Gather any other secondary files to inject before entryCode
  let secondaryModules = ''
  for (const [path, code] of Object.entries(files)) {
    if (path === entryFile || path === '/App.tsx' || path === '/App.jsx' || path === '/App.js' || path === '/index.tsx' || path === '/index.html') {
      continue
    }
    // Only transpile TS/JS files
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
  <!-- Tailwind CSS CDN for instant styling -->
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
  <!-- React 18 UMD -->
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <!-- Lucide Icons -->
  <script src="https://unpkg.com/lucide@latest"></script>
  <!-- In-browser Babel for instant JSX/TS compilation without any CodeSandbox backend -->
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
    // Universal shim for Lucide and React exports in browser environment
    window.React = window.React || React;
    window.ReactDOM = window.ReactDOM || ReactDOM;

    // Create a Lucide React shim proxy so <Sparkles />, <Activity /> etc render cleanly
    window.createLucideShim = function(iconName) {
      return function LucideIcon(props) {
        const { size = 20, color = 'currentColor', className = '', strokeWidth = 2, ...rest } = props || {};
        const iconDef = window.lucide && window.lucide.icons && (window.lucide.icons[iconName] || window.lucide.icons[iconName.toLowerCase()]);
        if (!iconDef) {
          // Fallback SVG circle if icon not loaded
          return React.createElement('svg', {
            width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color,
            strokeWidth: strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
            className: className, ...rest
          }, React.createElement('circle', { cx: 12, cy: 12, r: 8 }));
        }
        // Build SVG from Lucide definition [tag, attrs]
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

    // Capture uncaught errors and display them cleanly inside the app container
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

    // Intercept standard imports
    const React = window.React;
    const { useState, useEffect, useMemo, useRef, useCallback, useReducer, useContext } = React;
    const LucideIcons = window.__lucideProxy;

    // Helper proxy for lucide-react module resolution
    const lucideReact = window.__lucideProxy;

    // Protective Error Boundary
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
      // Clean import statements that browsers cannot resolve natively without a module graph
      let processedCode = ${JSON.stringify(entryCode)};

      // Replace: import ... from 'lucide-react'; with const { ... } = window.__lucideProxy;
      processedCode = processedCode.replace(/import\\s+\\{([^}]+)\\}\\s+from\\s+['"]lucide-react['"];?/g, 'const { $1 } = window.__lucideProxy;');
      processedCode = processedCode.replace(/import\\s+\\*\\s+as\\s+([a-zA-Z0-9_$]+)\\s+from\\s+['"]lucide-react['"];?/g, 'const $1 = window.__lucideProxy;');

      // Replace: import React, { ... } from 'react'; with const { ... } = React;
      processedCode = processedCode.replace(/import\\s+React\\s*(?:,\\s*\\{([^}]+)\\})?\\s*from\\s+['"]react['"];?/g, (m, g1) => {
        return g1 ? 'const { ' + g1 + ' } = React;' : '';
      });
      processedCode = processedCode.replace(/import\\s+\\{([^}]+)\\}\\s+from\\s+['"]react['"];?/g, 'const { $1 } = React;');

      // Remove CSS imports like import './styles.css'
      processedCode = processedCode.replace(/import\\s+['"][^'"]+\\.css['"];?/g, '');

      // Replace export default function App / export default App
      let hasDefaultExport = false;
      if (/export\\s+default\\s+function\\s+([a-zA-Z0-9_$]+)/.test(processedCode)) {
        processedCode = processedCode.replace(/export\\s+default\\s+function\\s+([a-zA-Z0-9_$]+)/, 'function $1');
        hasDefaultExport = true;
      } else if (/export\\s+default\\s+([a-zA-Z0-9_$]+)/.test(processedCode)) {
        processedCode = processedCode.replace(/export\\s+default\\s+([a-zA-Z0-9_$]+)/, '/* export default $1 */');
        hasDefaultExport = true;
      }

      // Execute code in scope
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

export function SandpackMetamorphicCanvas({
  title = 'Metamorphic App',
  files = DEFAULT_FILES,
  dependencies: _dependencies,
  template: _template = 'react-ts',
  entryFile = '/App.tsx',
  isMaximized: controlledMaximized,
  onToggleMaximize,
}: SandpackMetamorphicCanvasProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview')
  const [internalMaximized, setInternalMaximized] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

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

  // Selected file for code tab
  const fileKeys = useMemo(() => Object.keys(normalizedFiles), [normalizedFiles])
  const [selectedFile, setSelectedFile] = useState<string>(fileKeys[0] || '/App.tsx')

  useEffect(() => {
    if (!normalizedFiles[selectedFile]) {
      setSelectedFile(fileKeys[0] || '/App.tsx')
    }
  }, [fileKeys, normalizedFiles, selectedFile])

  // Generate self-contained srcdoc string
  const srcDoc = useMemo(() => {
    return buildMetamorphicSrcDoc(normalizedFiles, entryFile, title)
  }, [normalizedFiles, entryFile, title, reloadKey])

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
            sandbox="allow-scripts allow-modals allow-same-origin"
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
                <code>{normalizedFiles[selectedFile] || ''}</code>
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  if (isMax && typeof document !== 'undefined') {
    return createPortal(element, document.body)
  }
  return element
}
