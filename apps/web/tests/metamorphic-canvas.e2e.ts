// Web e2e scenario: the metamorphic canvas in a real browser.
//
// The package spec pins the compile contract with Babel stubbed, and the
// toolchain check (scripts/verify-metamorphic-runtime.mjs) runs the real
// compiler in Node — neither one proves the document renders in a browser. This
// scenario mounts the shipped builder's output in Chromium and drives it: a
// React entry must reach the screen, an unsupported import must be refused with
// a diagnostic, and the sandbox must keep the frame off the host origin.
//
// Zero model calls: the document is built from the shipped runtime and mounted
// directly, so the scenario needs no host, no session, and no network beyond the
// canvas's own pinned CDN assets.
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import { buildMetamorphicSrcDoc, METAMORPHIC_SANDBOX } from '@deepseek-ai/dsh-client-ui-primitives'
import { saveFailureShot } from './support.ts'

const REACT_ENTRY = `import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import './styles.css';

interface Props { label: string }

export default function App({ label }: Props) {
  const [count, setCount] = useState(0);
  return (
    <div className="p-6">
      <h1>Canvas mounted OK</h1>
      <p>{label}</p>
      <Sparkles size={18} />
      <button onClick={() => setCount(count + 1)}>clicks {count}</button>
    </div>
  );
}
`

const UNSUPPORTED_ENTRY = `import { LineChart } from 'recharts';
export default function App() { return <div>never</div> }
`

/** Mount one built document in a fresh unsandboxed page. */
async function mountDocument(page: Page, srcDoc: string): Promise<void> {
  await page.setContent('<!doctype html><html><body style="margin:0"><iframe id="canvas" style="width:900px;height:600px;border:0"></iframe></body></html>')
  await page.evaluate(({ doc, sandbox }) => {
    const frame = document.getElementById('canvas') as HTMLIFrameElement
    frame.setAttribute('sandbox', sandbox)
    frame.srcdoc = doc
  }, { doc: srcDoc, sandbox: METAMORPHIC_SANDBOX })
}

describe('web e2e: the metamorphic canvas renders agent-authored apps', () => {
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    browser = await chromium.launch()
    page = await browser.newPage()
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
  })

  it('compiles and mounts a canonical React/TSX entry with working state', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-metamorphic-canvas'))
    await mountDocument(page, buildMetamorphicSrcDoc({ '/App.tsx': REACT_ENTRY }, '/App.tsx', 'React probe'))
    const frame = page.frameLocator('#canvas')
    await expect.poll(() => frame.getByText('Canvas mounted OK').count(), { timeout: 45_000 }).toBe(1)
    // The lucide import must resolve to a rendered icon: a shim that reads the
    // wrong icon shape hands React an undefined element type and takes the
    // whole app down, which is how this was caught.
    await expect.poll(() => frame.locator('svg path').count(), { timeout: 10_000 }).toBeGreaterThan(0)
    // Real state: the click re-renders through the mounted component.
    await frame.getByRole('button', { name: 'clicks 0' }).click()
    await expect.poll(() => frame.getByRole('button', { name: 'clicks 1' }).count(), { timeout: 15_000 }).toBe(1)
  }, 90_000)

  it('refuses an import it cannot serve, naming the specifier', async () => {
    await mountDocument(page, buildMetamorphicSrcDoc({ '/App.tsx': UNSUPPORTED_ENTRY }, '/App.tsx', 'Refusal probe'))
    const frame = page.frameLocator('#canvas')
    await expect.poll(() => frame.getByText('Unsupported import').count(), { timeout: 20_000 }).toBe(1)
    await expect.poll(() => frame.getByText('recharts').count(), { timeout: 10_000 }).toBe(1)
  }, 60_000)

  it('keeps the mounted app off the host origin', async () => {
    await mountDocument(page, buildMetamorphicSrcDoc({ '/App.tsx': REACT_ENTRY }, '/App.tsx', 'Isolation probe'))
    const frame = page.frameLocator('#canvas')
    await expect.poll(() => frame.getByText('Canvas mounted OK').count(), { timeout: 45_000 }).toBe(1)
    const frameElement = page.locator('#canvas')
    expect(await frameElement.getAttribute('sandbox')).toBe('allow-scripts allow-modals')
    // Storage exists because the document installs its own, and reaching the
    // parent's document must fail: both are the opaque origin working.
    const outcome = await frame.locator('body').evaluate(() => {
      const results = { storage: 'threw', parentAccess: 'allowed' }
      try {
        window.localStorage.setItem('probe', '1')
        if (window.localStorage.getItem('probe') === '1') results.storage = 'memory'
      } catch { /* the shim failed; the assertion below reports it */ }
      try {
        void (window.parent as Window).document.body
      } catch {
        results.parentAccess = 'blocked'
      }
      return results
    })
    expect(outcome).toEqual({ storage: 'memory', parentAccess: 'blocked' })
  }, 90_000)
})
