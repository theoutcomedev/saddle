// @vitest-environment jsdom
/**
 * Metamorphic runtime spec. The document it builds is the contract both app
 * surfaces share, so these cases pin the compile path (classic React runtime,
 * script source type), the closed module surface, and every diagnostic the
 * canvas can show instead of a blank iframe.
 *
 * `window.Babel` is a recording stub here: the browser loads the real compiler
 * from a CDN, and the option contract is what this layer owns. The end-to-end
 * compile check with the real compiler is
 * `.agents/skills/saddle-apps/scripts/verify-metamorphic-runtime.mjs`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildMetamorphicSrcDoc,
  METAMORPHIC_MOUNT_SOURCE,
  METAMORPHIC_SANDBOX,
  prepareMetamorphicEntry,
} from '../src/index.ts'

const CANONICAL = `import React, { useState } from 'react';
import { Sparkles, Activity } from 'lucide-react';
import './styles.css';

export default function App() {
  const [count, setCount] = useState(0);
  return <div className="p-4"><Sparkles size={18} /><h1>{count}</h1></div>;
}
`

describe('prepareMetamorphicEntry', () => {
  it('resolves the canonical React entry surface', () => {
    const prepared = prepareMetamorphicEntry(CANONICAL)
    expect(prepared.componentName).toBe('App')
    expect(prepared.unsupportedImports).toEqual([])
    expect(prepared.code).not.toMatch(/from 'react'/)
    expect(prepared.code).not.toMatch(/styles\.css/)
    expect(prepared.code).toContain('const { Sparkles, Activity } = __saddleLucide;')
    expect(prepared.code).toContain('function App()')
    // JSX survives to the compiler: it is Babel's job, not this layer's.
    expect(prepared.code).toContain('<div className="p-4">')
  })

  it('keeps a named default export and rewrites other defaults to a binding', () => {
    expect(prepareMetamorphicEntry('export default function Tracker() { return null }').componentName).toBe('Tracker')
    expect(prepareMetamorphicEntry('export default class Panel {}').componentName).toBe('Panel')
    const arrow = prepareMetamorphicEntry('const Card = () => null;\nexport default Card;')
    expect(arrow.componentName).toBe('__saddleDefault')
    expect(arrow.code).toContain('const __saddleDefault = Card;')
  })

  it('falls back to an App declaration, then to the default binding', () => {
    const named = prepareMetamorphicEntry('export function App() { return null }')
    expect(named.componentName).toBe('App')
    expect(named.code).not.toMatch(/^\s*export\s/m)
    expect(prepareMetamorphicEntry('const App = () => null;').componentName).toBe('App')
    expect(prepareMetamorphicEntry('const other = 1;').componentName).toBe('__saddleDefault')
  })

  it('reports every module specifier the canvas cannot serve', () => {
    const prepared = prepareMetamorphicEntry(`import { LineChart } from 'recharts';
import Helper from './Helper';
import 'side-effect-package';
export default function App() { return null }`)
    expect(prepared.unsupportedImports).toEqual(['recharts', './Helper', 'side-effect-package'])
  })

  it('serves react-dom and the jsx runtime itself', () => {
    const prepared = prepareMetamorphicEntry(`import { createPortal } from 'react-dom';
import { jsx } from 'react/jsx-runtime';
export default function App() { return null }`)
    expect(prepared.unsupportedImports).toEqual([])
  })
})

describe('buildMetamorphicSrcDoc', () => {
  it('returns an index.html entry verbatim', () => {
    expect(buildMetamorphicSrcDoc({ '/index.html': '<html>raw</html>' })).toBe('<html>raw</html>')
  })

  it('pins every runtime asset and never requests a floating tag', () => {
    const doc = buildMetamorphicSrcDoc({ '/App.tsx': CANONICAL })
    expect(doc).toContain('https://cdn.tailwindcss.com/3.4.16')
    expect(doc).toContain('react@18.3.1')
    expect(doc).toContain('react-dom@18.3.1')
    expect(doc).toContain('lucide@1.45.0')
    expect(doc).toContain('@babel/standalone@8.0.5')
    expect(doc).not.toMatch(/@latest/)
  })

  it('falls back through the entry candidates in order', () => {
    expect(buildMetamorphicSrcDoc({ '/App.jsx': CANONICAL })).toContain('function App()')
    expect(buildMetamorphicSrcDoc({ '/index.tsx': CANONICAL })).toContain('function App()')
    expect(buildMetamorphicSrcDoc({ '/main.js': CANONICAL })).toContain('function App()')
    expect(buildMetamorphicSrcDoc({}, '/App.tsx')).toContain('saddleMountApp')
  })

  it('renders a diagnostic for an unsupported import instead of a broken app', () => {
    const doc = buildMetamorphicSrcDoc({ '/App.tsx': "import { LineChart } from 'recharts'\nexport default function App() { return null }" })
    expect(doc).toContain('Unsupported import')
    expect(doc).toContain('recharts')
  })

  it('escapes the title and any embedded script terminator', () => {
    const doc = buildMetamorphicSrcDoc({ '/App.tsx': 'const tag = "</script>"; export default function App() { return tag }' }, '/App.tsx', 'A & B <c>')
    expect(doc).toContain('<title>A &amp; B &lt;c&gt;</title>')
    // The entry is embedded as a literal, so its terminator never ends the element.
    expect(doc).not.toContain('"</script>"')
    expect(doc).toContain('<\\/script>'.replace('\\\\', '\\'))
  })

  it('carries the mount contract the iframe needs', () => {
    const doc = buildMetamorphicSrcDoc({ '/App.tsx': CANONICAL })
    expect(doc).toContain('window.__saddle_booted = false')
    expect(doc).toContain('window.createLucideShim')
    expect(doc).toContain('saddleMemoryStorage')
    expect(doc).toContain('The app did not start')
    expect(doc).toContain('Runtime assets did not load')
    expect(METAMORPHIC_SANDBOX).toBe('allow-scripts allow-modals')
  })
})

describe('the mount step', () => {
  const mount = new Function(`${METAMORPHIC_MOUNT_SOURCE}; return saddleMountApp;`)() as (config: {
    source: string
    componentName: string
    prelude: readonly string[]
  }) => void

  const calls = { transforms: [] as Record<string, unknown>[], roots: 0 }
  const createElement = (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children })

  beforeEach(() => {
    calls.transforms = []
    calls.roots = 0
    document.body.innerHTML = '<div id="root"></div>'
    const React = {
      createElement,
      useState: () => [null, () => undefined],
      useEffect: () => undefined,
    }
    Object.assign(window, {
      React,
      ReactDOM: { createRoot: () => { calls.roots += 1; return { render: () => undefined } } },
      __saddleLucide: {},
      __saddle_booted: false,
      Babel: {
        transform: (source: string, options: Record<string, unknown>) => {
          calls.transforms.push({ source, ...options })
          return { code: source }
        },
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('compiles with the classic React runtime and a script source type', () => {
    mount({ source: 'function App() { return null }', componentName: 'App', prelude: ['useState'] })
    const [call] = calls.transforms
    expect(call?.['sourceType']).toBe('script')
    expect(call?.['presets']).toEqual([['react', { runtime: 'classic' }], 'typescript'])
    expect(call?.['filename']).toBe('App.tsx')
    expect(calls.roots).toBe(1)
    expect((window as unknown as { __saddle_booted: boolean }).__saddle_booted).toBe(true)
  })

  it('reports a missing component rather than rendering nothing', () => {
    mount({ source: 'const other = 1;', componentName: '__saddleDefault', prelude: [] })
    expect(document.getElementById('root')?.innerHTML).toContain('No app component')
    expect(calls.roots).toBe(0)
  })

  it('reports a compiler failure and still marks the boot complete', () => {
    Object.assign(window, { Babel: { transform: () => { throw new Error('Unexpected token') } } })
    mount({ source: 'function App() { return null }', componentName: 'App', prelude: [] })
    expect(document.getElementById('root')?.innerHTML).toContain('Compilation Error')
    expect(document.getElementById('root')?.innerHTML).toContain('Unexpected token')
    expect((window as unknown as { __saddle_booted: boolean }).__saddle_booted).toBe(true)
  })
})
