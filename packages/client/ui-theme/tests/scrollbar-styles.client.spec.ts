/**
 * Scrollbar stylesheet contract, asserted against the CSS text on disk.
 *
 * This product hides native scrollbars rather than styling them: the sheets keep
 * the rebindable `--dsh-scrollbar-*` indirection (elevated surfaces still declare
 * the l2 pair, so lifting the hide rule restores a fully themed bar) while every
 * scroller renders no visible bar at all. The assertions below pin that contract,
 * not the upstream one where the bar itself was painted.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const STYLES = new URL('../src/styles/', import.meta.url)
// tests/ → ui-theme → client → packages → repository root.
const REPO = fileURLToPath(new URL('../../../../', import.meta.url))
const readStyle = (name: string): string => readFileSync(fileURLToPath(new URL(name, STYLES)), 'utf8')

const platformCss = readStyle('design-platform.css')
const scrollbarCss = readStyle('scrollbar.css')

/** Every stylesheet under packages/client, as [path, text] pairs. */
function clientSheets(): [string, string][] {
  const roots = readdirSync(join(REPO, 'packages/client'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(REPO, 'packages/client', entry.name, 'src'))
  const sheets: [string, string][] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith('.css')) sheets.push([path.slice(REPO.length), readFileSync(path, 'utf8')])
    }
  }
  for (const root of roots) walk(root)
  return sheets
}

describe('scrollbar.css base surface binding', () => {
  it('binds the base pair on body to the l1 elevation tokens', () => {
    expect(scrollbarCss).toContain('--dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l1)')
    expect(scrollbarCss).toContain('--dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l1)')
  })

  it('reports a zero width, so consumers aligning beside the bar reserve nothing', () => {
    expect(scrollbarCss).toContain('--dsh-scrollbar-width: 0px')
  })
})

describe('scrollbar.css hides every native bar', () => {
  it('turns the standard property off for the body and every descendant', () => {
    expect(scrollbarCss).toMatch(/body,\s*body \*\s*\{[^}]*scrollbar-width: none/)
  })

  it('turns the WebKit pseudo-element off without leaving a width behind', () => {
    const block = /::-webkit-scrollbar\s*\{([^}]*)\}/.exec(scrollbarCss)?.[1] ?? ''
    expect(block).toContain('display: none')
    expect(block).toContain('width: 0px')
    expect(block).toContain('height: 0px')
  })
})

describe('design platform tokens under the hide rule', () => {
  it('defines both elevation pairs the sheet and the rebinds name', () => {
    for (const token of [
      '--dsw-alias-scrollbar-bg-l1', '--dsw-alias-scrollbar-hover-l1',
      '--dsw-alias-scrollbar-bg-l2', '--dsw-alias-scrollbar-hover-l2',
    ]) {
      expect(platformCss, token).toContain(token + ':')
    }
  })

  it('keeps every elevated rebind a complete pair, on the l2 rung or hidden', () => {
    const sheets = clientSheets().filter(([path]) => !path.includes('ui-theme/src/styles'))
    const offenders: string[] = []
    for (const [path, text] of sheets) {
      // One rule per chunk: the sheets under test never nest these declarations.
      for (const block of text.split('}')) {
        const thumb = /--dsh-scrollbar-thumb:\s*([^;]+);/.exec(block)?.[1]?.trim()
        if (thumb === undefined) continue
        const hover = /--dsh-scrollbar-thumb-hover:\s*([^;]+);/.exec(block)?.[1]?.trim()
        // A surface either takes the l2 elevation rung, or draws no thumb at all.
        const hidden = thumb === 'transparent'
        if (thumb !== (hidden ? 'transparent' : 'var(--dsw-alias-scrollbar-bg-l2)')) {
          offenders.push(`${path} (rung: ${thumb})`)
        } else if (hover !== (hidden ? 'transparent' : 'var(--dsw-alias-scrollbar-hover-l2)')) {
          offenders.push(`${path} (hover partner: ${hover ?? 'missing'})`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
