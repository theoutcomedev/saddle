/**
 * QuestionComposer stylesheet contract, asserted against the CSS text on disk.
 * The recommendation badge is the case worth pinning: it is a tinted chip with
 * text on it, so its fill and its label have to be a pair that survives every
 * palette rather than a fill borrowed from another surface.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/QuestionComposer.module.css', import.meta.url)), 'utf8')

/**
 * Declarations of one selector rule, keyed by property with whitespace collapsed.
 * @param selector - one exact selector, including a leading dot for local classes.
 * @returns the rule's declarations, or undefined when no such rule exists.
 */
function declarationsFrom(source: string, selector: string): Map<string, string> | undefined {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const found = new Map<string, string>()
  for (const [, selectorList = '', body = ''] of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectorList.split(',').map(value => value.trim()).includes(selector)) continue
    for (const part of body.split(';')) {
      const colon = part.indexOf(':')
      if (colon === -1) continue
      found.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim().replace(/\s+/g, ' '))
    }
  }
  return found.size === 0 ? undefined : found
}

describe('QuestionComposer.module.css recommendation badge', () => {
  const badge = declarationsFrom(css, '.badge')

  it('pairs a business-state surface with the primary label', () => {
    expect(badge).toBeDefined()
    expect(badge?.get('background')).toBe('var(--dsw-alias-state-business-tertiary)')
    expect(badge?.get('color')).toBe('var(--dsw-alias-label-primary)')
  })

  it('never paints its label on a fill that cannot hold it', () => {
    // The sidebar accent rung is a near-white cream in the light sheet: a white
    // label on it is invisible there and washed out in the palettes that raise it.
    expect(badge?.get('background')).not.toContain('--dsw-specific-sidebar-nav-item-active-accent')
    expect(badge?.get('color')).not.toMatch(/^#fff/i)
  })
})
