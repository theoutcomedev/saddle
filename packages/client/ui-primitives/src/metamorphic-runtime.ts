/**
 * The metamorphic app runtime: one agent-authored module, compiled in the
 * browser and executed inside a sandboxed iframe.
 *
 * Both surfaces that host a mounted app — the chat tool card and the Workbench
 * dock — build their document here, so the two can never disagree about what
 * the canvas supports. The canvas is deliberately closed: React 18 with its
 * hooks, a lucide icon proxy, one entry module, and no package resolution. An
 * app that needs anything else ships `/index.html`, which is returned verbatim.
 *
 * Compilation goes through one explicit `Babel.transform` call rather than a
 * `<script type="text/babel">` tag, so the React preset runs with the classic
 * runtime: the automatic runtime emits `import ... from "react/jsx-runtime"`,
 * which no module resolution in this document can satisfy.
 *
 * @module dsh-client-ui-primitives/metamorphic-runtime
 */

/**
 * The iframe sandbox this runtime requires.
 *
 * `allow-same-origin` is deliberately absent: with it, a `srcdoc` document
 * inherits the host origin and the mounted app can read Saddle's storage, DOM
 * and same-origin API responses. Without it the document is an opaque origin,
 * which is the isolation the canvas promises.
 */
export const METAMORPHIC_SANDBOX = 'allow-scripts allow-modals'

/**
 * Runtime assets, pinned. An unpinned CDN tag is a silent upgrade to whatever
 * the registry served that minute, and an app's ability to compile should not
 * depend on that.
 */
const TAILWIND_CDN = 'https://cdn.tailwindcss.com/3.4.16'
const REACT_UMD = 'https://unpkg.com/react@18.3.1/umd/react.production.min.js'
const REACT_DOM_UMD = 'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js'
const LUCIDE_UMD = 'https://unpkg.com/lucide@1.45.0'
const BABEL_STANDALONE = 'https://unpkg.com/@babel/standalone@8.0.5/babel.min.js'

/**
 * How long the document waits before it reports that nothing started. The
 * iframe is blank while its assets load, so silence has to become a diagnosis
 * rather than a white rectangle.
 */
const BOOT_TIMEOUT_MS = 8_000

/**
 * React names the entry prelude binds. They live in the scope the entry
 * executes inside, so an entry that imports them, or uses them without
 * importing anything, resolves either way.
 */
const REACT_PRELUDE = [
  'useState', 'useEffect', 'useMemo', 'useRef', 'useCallback', 'useReducer',
  'useContext', 'useLayoutEffect', 'useImperativeHandle', 'useSyncExternalStore',
  'useTransition', 'useDeferredValue', 'useId', 'Component', 'PureComponent',
  'Fragment', 'StrictMode', 'Suspense', 'createContext', 'createElement',
  'cloneElement', 'isValidElement', 'memo', 'forwardRef', 'lazy', 'Children',
] as const

/** Module specifiers the canvas serves itself. */
const PROVIDED_MODULES: ReadonlySet<string> = new Set([
  'react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'lucide-react', 'lucide',
])

/** One prepared entry module. */
export interface PreparedEntry {
  /** The entry source with its imports and export keywords resolved. */
  code: string
  /** The binding the compiled module reads the component from. */
  componentName: string
  /** Module specifiers the canvas cannot serve, in source order. */
  unsupportedImports: readonly string[]
}

/**
 * Every module specifier an entry imports or re-exports.
 * @param code - the entry module's source.
 * @returns the specifiers in source order, without duplicates.
 */
function moduleSpecifiers(code: string): string[] {
  const found: string[] = []
  const pattern = /\b(?:import|export)\b[^;'"]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]/g
  for (const match of code.matchAll(pattern)) {
    const specifier = match[1] ?? match[2]
    if (specifier !== undefined && !found.includes(specifier)) found.push(specifier)
  }
  return found
}

/**
 * The component binding a prepared entry leaves in scope.
 * @param code - the original entry source.
 * @returns the declared name, or `undefined` when the default export supplied it.
 */
function declaredComponent(code: string): string | undefined {
  const named = /\bexport\s+default\s+(?:async\s+)?(?:function|class)\s+([A-Za-z0-9_$]+)/.exec(code)
  if (named?.[1] !== undefined) return named[1]
  if (/\bexport\s+default\b/.test(code)) return undefined
  if (/\b(?:function|const|let|var|class)\s+App\b/.test(code)) return 'App'
  return undefined
}

/**
 * Resolve one entry module into the source the canvas compiles.
 *
 * React and its hooks come from the prelude rather than from the entry's own
 * import statements, and the entry stays wrapped in an inner function so a
 * hand-written `const { useState } = React` shadows the prelude instead of
 * redeclaring it. Anything the canvas cannot serve is reported rather than
 * rewritten: a half-rewritten import surfaces as an inscrutable parser error.
 * @param code - the entry module's source.
 * @returns the prepared source, the component binding, and unsupported specifiers.
 */
export function prepareMetamorphicEntry(code: string): PreparedEntry {
  // A stylesheet import is stripped below rather than resolved, so it is not a
  // module the canvas failed to serve.
  const unsupportedImports = moduleSpecifiers(code)
    .filter(specifier => !PROVIDED_MODULES.has(specifier) && !specifier.endsWith('.css'))
  const declared = declaredComponent(code)

  const prepared = code
    // lucide icons resolve through the icon proxy the document installs.
    .replace(/\bimport\s+\*\s+as\s+([A-Za-z0-9_$]+)\s+from\s+['"]lucide(?:-react)?['"];?/g, 'const $1 = __saddleLucide;')
    .replace(/\bimport\s+([A-Za-z0-9_$]+)\s+from\s+['"]lucide(?:-react)?['"];?/g, 'const $1 = __saddleLucide;')
    .replace(/\bimport\s*\{([^}]+)\}\s*from\s*['"]lucide(?:-react)?['"];?/g, 'const {$1} = __saddleLucide;')
    // React and ReactDOM arrive through the prelude; their imports vanish.
    .replace(/\bimport\s+(?:[A-Za-z0-9_$*{},\s]+?)\s*from\s*['"]react(?:-dom(?:\/client)?|\/jsx-runtime)?['"];?/g, '')
    .replace(/\bimport\s*['"]react(?:-dom(?:\/client)?|\/jsx-runtime)?['"];?/g, '')
    // Stylesheet imports have no meaning in a single document.
    .replace(/\bimport\s*['"][^'"]+\.css['"];?/g, '')
    // A named default export keeps its name; every other default becomes a binding.
    .replace(/\bexport\s+default\s+(?:async\s+)?(?:function|class)\s+([A-Za-z0-9_$]+)/g,
      (match: string) => match.replace(/\bexport\s+default\s+/, ''))
    .replace(/\bexport\s+default\s+/g, 'const __saddleDefault = ')
    // Named exports are ordinary declarations once the keyword is gone.
    .replace(/^[ \t]*export\s+(?=(?:async\s+)?(?:function|class|const|let|var)\b)/gm, '')
    .replace(/^[ \t]*export\s*\{[^}]*\}\s*;?/gm, '')

  return { code: prepared, componentName: declared ?? '__saddleDefault', unsupportedImports }
}

/** The inline error card every diagnostic renders into the app container. */
function diagnosticCard(title: string, detail: string): string {
  return '<div class="error-container"><div class="error-title">' + title + '</div><div>' + detail + '</div></div>'
}

/** Embed a value as a JavaScript literal inside a script element. */
function literal(value: unknown): string {
  // `</script` inside a literal would end the element early.
  return JSON.stringify(value).replace(/<\/(script)/gi, '<\\/$1')
}

/** Escape text for the document title element. */
function titleText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Compile one prepared entry and mount it, or report why it could not be.
 *
 * This source is inlined into the document and evaluated by the package tests
 * unchanged, so the browser and the test run the same compiler call rather
 * than two descriptions of it. Globals it reads: `window.Babel`,
 * `window.React`, `window.ReactDOM`, `window.__saddleLucide`, `document`.
 */
export const METAMORPHIC_MOUNT_SOURCE = `function saddleMountApp(config) {
  var root = document.getElementById('root');
  var setError = function (title, detail) {
    root.innerHTML = '<div class="error-container"><div class="error-title">' + title + '</div><div>' + detail + '</div></div>';
  };
  try {
    var compiled = window.Babel.transform(config.source, {
      filename: 'App.tsx',
      sourceType: 'script',
      presets: [
        ['react', { runtime: 'classic' }],
        'typescript',
      ],
    }).code;
    // The prelude lives outside the entry's own scope: an entry that declares
    // the same bindings shadows it instead of colliding with it.
    var factory = new Function('React', 'ReactDOM', '__saddleLucide',
      'const { ' + config.prelude.join(', ') + ' } = React;'
      + 'return (function () {' + compiled
      + '; return typeof ' + config.componentName + ' !== "undefined" ? ' + config.componentName + ' : null; })();');
    var App = factory(window.React, window.ReactDOM, window.__saddleLucide);
    if (!App) {
      setError('No app component', 'The entry declares no default export and no ' + config.componentName + ' component.');
      return;
    }
    var React = window.React;
    function ErrorBoundary(props) {
      var state = React.useState(null);
      var error = state[0];
      var setError = state[1];
      React.useEffect(function () { /* keep the hook order stable across retries */ }, []);
      if (error) {
        return React.createElement('div', { className: 'error-container' },
          React.createElement('div', { className: 'error-title' }, 'Application Error'),
          React.createElement('div', null, (error && error.message) || String(error)),
          React.createElement('div', { style: { marginTop: '12px' } },
            React.createElement('button', {
              className: 'px-3 py-1.5 bg-red-500/20 text-red-300 rounded border border-red-500/30 text-xs font-semibold hover:bg-red-500/30',
              onClick: function () { setError(null); },
            }, 'Retry Execution')));
      }
      return props.children;
    }
    window.ReactDOM.createRoot(root).render(React.createElement(ErrorBoundary, null, React.createElement(App)));
  } catch (error) {
    setError('Compilation Error', (error && error.message) || String(error));
  } finally {
    window.__saddle_booted = true;
  }
}`

/**
 * The bootstrap that runs before any app code: storage the opaque origin would
 * otherwise throw on, the lucide icon proxy, and the error surface.
 */
const BOOTSTRAP = `    // An opaque origin has no storage; an app that persists state gets memory
    // instead of a SecurityError.
    function saddleMemoryStorage() {
      var data = {};
      return {
        getItem: function (key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
        setItem: function (key, value) { data[key] = String(value); },
        removeItem: function (key) { delete data[key]; },
        clear: function () { data = {}; },
        key: function (index) { return Object.keys(data)[index] || null; },
        get length() { return Object.keys(data).length; },
      };
    }
    ['localStorage', 'sessionStorage'].forEach(function (name) {
      try {
        window[name].getItem('__saddle_probe');
      } catch (_opaqueOrigin) {
        Object.defineProperty(window, name, { value: saddleMemoryStorage(), configurable: true });
      }
    });

    window.__saddle_booted = false;
    window.createLucideShim = function (iconName) {
      return function LucideIcon(props) {
        var options = props || {};
        var size = options.size === undefined ? 20 : options.size;
        var color = options.color === undefined ? 'currentColor' : options.color;
        var className = options.className || '';
        var strokeWidth = options.strokeWidth === undefined ? 2 : options.strokeWidth;
        var rest = Object.assign({}, options);
        delete rest.size; delete rest.color; delete rest.className; delete rest.strokeWidth;
        var icons = (window.lucide && window.lucide.icons) || {};
        var entry = icons[iconName]
          || icons[iconName.charAt(0).toUpperCase() + iconName.slice(1)];
        // lucide has shipped both shapes: the legacy [tag, attrs, children]
        // tuple and the bare children array. A shim that knows only the first
        // turns the second into createElement(undefined) and React refuses to
        // render the whole app.
        var nodes = Array.isArray(entry) && typeof entry[0] === 'string' ? entry[2] : entry;
        var children = (nodes || []).filter(Array.isArray).map(function (item, index) {
          return React.createElement(item[0], Object.assign({ key: index }, item[1]));
        });
        var base = {
          width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color,
          strokeWidth: strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', className: className,
        };
        if (children.length === 0) {
          // An icon name this lucide build does not ship still has to render
          // something: a plain placeholder beats a blank canvas.
          children = [React.createElement('circle', { key: 'fallback', cx: 12, cy: 12, r: 8 })];
        }
        return React.createElement('svg', Object.assign(base, rest), children);
      };
    };
    window.__saddleLucide = new Proxy({}, {
      get: function (_target, property) {
        if (typeof property !== 'string' || property === 'then' || property === 'default') return undefined;
        return window.createLucideShim(property);
      },
    });`

const STYLES = `    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow-x: hidden;
      background: #090d16;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    #root { min-height: 100%; width: 100%; display: flex; flex-direction: column; }
    .error-container {
      padding: 24px;
      margin: 20px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 12px;
      color: #fca5a5;
      font-family: ui-monospace, monospace;
      font-size: 13px;
      line-height: 1.5;
    }
    .error-title { font-weight: bold; color: #ef4444; margin-bottom: 8px; font-size: 14px; }`

/**
 * Build the document a mounted app runs in.
 * @param files - the virtual files the agent mounted, keyed by absolute path.
 * @param entryFile - the module to execute; defaults to `/App.tsx`.
 * @param title - the app title, shown in the document and its error cards.
 * @returns the `srcdoc` document for the sandboxed iframe.
 */
export function buildMetamorphicSrcDoc(
  files: Record<string, string>,
  entryFile = '/App.tsx',
  title = 'Metamorphic App',
): string {
  const html = files['/index.html'] ?? files['index.html']
  if (html !== undefined) return html

  const entryCode = files[entryFile]
    ?? files['/App.tsx']
    ?? files['/App.jsx']
    ?? files['/App.js']
    ?? files['/index.tsx']
    ?? Object.values(files)[0]
    ?? ''

  const prepared = prepareMetamorphicEntry(entryCode)
  const blockers: string[] = []
  if (prepared.unsupportedImports.length > 0) {
    blockers.push(diagnosticCard(
      'Unsupported import',
      'This app imports ' + prepared.unsupportedImports.map(one => '<code>' + one + '</code>').join(', ')
      + ', which the canvas cannot resolve — it serves React, its hooks, and lucide icons only.'
      + ' Inline the module, or ship a self-contained <code>/index.html</code>.',
    ))
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titleText(title)}</title>
  <script src="${TAILWIND_CDN}"></script>
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
  <script src="${REACT_UMD}" crossorigin></script>
  <script src="${REACT_DOM_UMD}" crossorigin></script>
  <script src="${LUCIDE_UMD}"></script>
  <script src="${BABEL_STANDALONE}"></script>
  <style>
${STYLES}
  </style>
</head>
<body>
  <div id="root"></div>

  <script>
${BOOTSTRAP}
  </script>

  <script>
    // Nothing has rendered by now: say which of the two things went wrong
    // instead of leaving a blank rectangle.
    setTimeout(function () {
      if (window.__saddle_booted) return;
      var root = document.getElementById('root');
      if (!root || root.innerHTML) return;
      var missing = ['React', 'ReactDOM', 'lucide', 'Babel', 'tailwind']
        .filter(function (name) { return !window[name]; });
      root.innerHTML = missing.length > 0
        ? '<div class="error-container"><div class="error-title">Runtime assets did not load</div><div>'
          + 'The canvas compiles apps from public CDNs; still missing: ' + missing.join(', ')
          + '. A blocked network, proxy, or Content-Security-Policy on this page stops every app from running.</div></div>'
        : '<div class="error-container"><div class="error-title">The app did not start</div><div>'
          + 'The compiler ran but nothing mounted. Open the browser console for the error.</div></div>';
    }, ${BOOT_TIMEOUT_MS});
  </script>

  <script>
${METAMORPHIC_MOUNT_SOURCE}
  </script>

  <script>
    (function () {
      var blockers = ${literal(blockers)};
      if (blockers.length > 0) {
        document.getElementById('root').innerHTML = blockers.join('');
        window.__saddle_booted = true;
        return;
      }
      if (!window.Babel || !window.React || !window.ReactDOM) {
        // The watchdog above reports which asset is missing.
        return;
      }
      saddleMountApp({
        source: ${literal(prepared.code)},
        componentName: ${literal(prepared.componentName)},
        prelude: ${JSON.stringify(REACT_PRELUDE)},
      });
    })();
  </script>
</body>
</html>`
}
