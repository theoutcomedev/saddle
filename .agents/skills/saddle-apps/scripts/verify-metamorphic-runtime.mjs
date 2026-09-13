/**
 * Verify the metamorphic canvas against the real browser compiler.
 *
 * The package spec (`packages/client/ui-primitives/tests/metamorphic-runtime.client.spec.ts`)
 * stubs Babel so it can pin the compile options; this script runs the same
 * mount source through the real `@babel/standalone` the iframe loads, which is
 * what proves a canonical React/TSX entry actually compiles and mounts.
 *
 * Usage, from the repository root:
 *   node .agents/skills/saddle-apps/scripts/verify-metamorphic-runtime.mjs
 */

import { createRequire } from 'node:module'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BABEL_VERSION = '8.0.5'
const require = createRequire(import.meta.url)

const { buildMetamorphicSrcDoc, prepareMetamorphicEntry, METAMORPHIC_MOUNT_SOURCE } =
  await import(new URL('../../../../packages/client/ui-primitives/src/metamorphic-runtime.ts', import.meta.url).href)

const scratch = mkdtempSync(join(tmpdir(), 'saddle-metamorphic-'))
const babelFile = join(scratch, 'babel-standalone.js')
const response = await fetch(`https://unpkg.com/@babel/standalone@${BABEL_VERSION}/babel.min.js`)
writeFileSync(babelFile, Buffer.from(await response.arrayBuffer()))
const Babel = require(babelFile)

const mountApp = new Function(`${METAMORPHIC_MOUNT_SOURCE}; return saddleMountApp;`)()

/** A React stub: enough for the mount source to run without a browser. */
function installStubs() {
  const calls = { roots: 0 }
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: () => [null, () => undefined],
    useEffect: () => undefined,
  }
  globalThis.window = {
    Babel,
    React,
    ReactDOM: { createRoot: () => { calls.roots += 1; return { render: () => undefined } } },
    __saddleLucide: new Proxy({}, { get: () => () => null }),
    __saddle_booted: false,
  }
  const root = { innerHTML: '' }
  globalThis.document = { getElementById: () => root }
  return { calls, root }
}

const ENTRIES = {
  canonical: `import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import './styles.css';
interface Props { label: string }
export default function App({ label }: Props) {
  const [count, setCount] = useState(0);
  useEffect(() => { void 0; }, []);
  return <div className="p-4"><Sparkles size={18} /><h1>{label} {count}</h1></div>;
}
`,
  bareHooks: `export default function App() {
  const [n, setN] = React.useState(0);
  return <div onClick={() => setN(n + 1)}>{n}</div>;
}
`,
  namedExport: `export function App() { return <div>named</div> }`,
  shadowedHooks: `import { useState } from 'react';
export default function App() { const { useState } = React; const [v] = useState(1); return <div>{v}</div>; }
`,
  brokenSyntax: `export default function App() { return <div>{</div>; }`,
}

let failures = 0
for (const [name, code] of Object.entries(ENTRIES)) {
  const { calls, root } = installStubs()
  const prepared = prepareMetamorphicEntry(code)
  mountApp({
    source: prepared.code,
    componentName: prepared.componentName,
    prelude: JSON.parse(/prelude: (\[[^\]]*\])/.exec(buildMetamorphicSrcDoc({ '/App.tsx': code }))?.[1] ?? '["useState"]'),
  })
  const expectedFailure = name === 'brokenSyntax'
  const mounted = calls.roots === 1 && root.innerHTML === ''
  const reported = root.innerHTML.includes('Compilation Error')
  const ok = expectedFailure ? reported : mounted
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  ' + root.innerHTML.slice(0, 160)))
  if (!ok) failures++
}

console.log(failures === 0 ? '\nmetamorphic runtime verified' : `\n${failures} entry(ies) failed`)
process.exit(failures === 0 ? 0 : 1)
