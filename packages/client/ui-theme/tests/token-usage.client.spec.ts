/**
 * Token-vocabulary contract for every client stylesheet.
 *
 * A CSS custom property that nobody defines is not an error the engine reports:
 * the declaration is simply dropped, so the element silently keeps whatever it
 * inherited — a transparent fill, an unset border. That is how a fullscreen
 * canvas ended up painting the shell behind it, and how a badge ended up white
 * on a near-white rung. The theme owns the vocabulary, so it also owns this
 * check: a reference with no fallback must resolve, and the handful of
 * references that do carry a fallback are listed here so a new one fails
 * loudly instead of joining them.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
const CLIENT_ROOT = join(REPO_ROOT, 'packages/client')
const THEME_STYLES = join(CLIENT_ROOT, 'ui-theme/src/styles')

/**
 * References allowed to name a token the sheets do not define, because each
 * carries its own fallback and states the value it wants. Sweeping them means
 * deciding per site whether the fallback or a theme rung is intended, so they
 * are pinned here rather than swept blind.
 */
const ALLOWED_WITH_FALLBACK: readonly string[] = [
  '--dsw-alias-bg-hover',
  '--dsw-alias-bg-subtle',
  '--dsw-alias-border-focus',
  '--dsw-alias-fill-hover',
  '--dsw-alias-interactive-bg-subtle',
  '--dsw-alias-interactive-border-focus',
  '--dsw-alias-interactive-primary',
  '--dsw-alias-state-success',
  '--dsw-alias-state-warning-primary',
  '--dsw-alias-status-danger',
  '--dsw-alias-surface-layer-1',
  '--dsw-font-mono',
]

/** Every CSS file under a client package's src tree, plus the theme sheets themselves. */
function stylesheets(): string[] {
  const found: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === 'lib' || entry === 'dist') continue
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (entry.endsWith('.css')) found.push(full)
    }
  }
  for (const pkg of readdirSync(CLIENT_ROOT)) {
    const src = join(CLIENT_ROOT, pkg, 'src')
    try { if (statSync(src).isDirectory()) walk(src) } catch { /* not a source package */ }
  }
  return found
}

/** Every --dsw-* name the theme sheets define. */
function definedTokens(): Set<string> {
  const names = new Set<string>()
  for (const file of readdirSync(THEME_STYLES)) {
    if (!file.endsWith('.css')) continue
    for (const [, name] of readFileSync(join(THEME_STYLES, file), 'utf8').matchAll(/(--dsw-[a-z0-9-]+)\s*:/g)) {
      if (name !== undefined) names.add(name)
    }
  }
  return names
}

/** Undefined references, split by whether the declaration survives via a fallback. */
function unresolvedReferences(): { hard: string[]; soft: string[] } {
  const defined = definedTokens()
  const hard = new Set<string>()
  const soft = new Set<string>()
  for (const file of stylesheets()) {
    for (const [, name, fallback] of readFileSync(file, 'utf8').matchAll(/var\((--dsw-[a-z0-9-]+)(\s*,[^)]*)?\)/g)) {
      if (name === undefined || defined.has(name)) continue
      const bucket = fallback === undefined ? hard : soft
      bucket.add(`${name} @ ${file.replace(REPO_ROOT, '')}`)
    }
  }
  return { hard: [...hard], soft: [...soft] }
}

describe('client stylesheet token vocabulary', () => {
  it('references no token the theme sheets leave undefined without a fallback', () => {
    // A hard miss drops the declaration: the element keeps an inherited value
    // instead of the one the stylesheet asked for.
    expect(unresolvedReferences().hard).toEqual([])
  })

  it('adds no new fallback-guarded reference beyond the pinned set', () => {
    const allowed = new Set(ALLOWED_WITH_FALLBACK)
    const unexpected = unresolvedReferences().soft
      .filter(entry => !allowed.has(entry.slice(0, entry.indexOf(' @ '))))
    expect(unexpected).toEqual([])
  })
})
