#!/usr/bin/env node
/**
 * Smoke-test a self-contained app document in jsdom.
 *
 * Usage:
 *   node verify-app.mjs <index.html> [--click=<selector>]... [--wait=800]
 *
 * The app is loaded with a stubbed 2D canvas context, so rendering calls are no-ops
 * but every listener, DOM build and animation frame still runs. A failure inside the
 * app is reported through the app's own error banner (the shell installs
 * `window.onerror`), so "banner clean" means the document booted and survived
 * interaction without throwing.
 *
 * Exit code is 1 if the app threw, so this is usable as a gate.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const args = process.argv.slice(2)
const htmlPath = args.find((a) => !a.startsWith('--'))
const clicks = args.filter((a) => a.startsWith('--click=')).map((a) => a.slice('--click='.length))
const wait = Number((args.find((a) => a.startsWith('--wait=')) || '--wait=800').slice(7))

if (!htmlPath) {
  console.error('usage: node verify-app.mjs <index.html> [--click=<selector>]... [--wait=800]')
  process.exit(2)
}

let JSDOM
for (const candidate of ['jsdom', '/app/node_modules/jsdom']) {
  try { JSDOM = require(candidate).JSDOM; break } catch { /* try next */ }
}
if (!JSDOM) {
  console.error('jsdom not found (tried "jsdom" and "/app/node_modules/jsdom")')
  process.exit(2)
}

const html = readFileSync(htmlPath, 'utf8')
const fakeCtx = new Proxy({}, {
  get: (_t, prop) => (prop === 'canvas' ? {} : () => {}),
  set: () => true,
})

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.HTMLCanvasElement.prototype.getContext = () => fakeCtx
  },
})
const w = dom.window
const d = w.document

const banner = () => {
  const el = d.getElementById('err')
  if (!el) return 'no #err element (app does not surface errors)'
  return el.style.display === 'block' ? `THREW -> ${el.textContent}` : 'clean'
}

setTimeout(() => {
  const first = banner()
  console.log(`banner after load : ${first}`)
  console.log(`title             : ${d.title}`)

  const counts = {
    'buttons': d.querySelectorAll('button').length,
    'sliders': d.querySelectorAll('input[type=range]').length,
    'canvas': d.querySelectorAll('canvas').length,
    'sections': d.querySelectorAll('section').length,
  }
  console.log('inventory         : ' + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' '))
  if (counts.canvas === 0) console.log('warning           : no <canvas> — is this a visual app?')

  for (const sel of clicks) {
    const el = d.querySelector(sel)
    if (!el) { console.log(`click ${sel} : NOT FOUND`); continue }
    try { el.click(); console.log(`click ${sel} : ok`) }
    catch (e) { console.log(`click ${sel} : threw ${e.message}`) }
  }

  setTimeout(() => {
    const second = banner()
    console.log(`banner after use  : ${second}`)
    const bad = second.startsWith('THREW') || first.startsWith('THREW')
    console.log(bad ? 'RESULT: FAILED' : 'RESULT: clean run')
    dom.window.close()
    process.exit(bad ? 1 : 0)
  }, wait)
}, wait)
