/**
 * Preview-card palette contract, asserted against the CSS text on disk.
 *
 * The floating sidebar Session/Workspace preview card is one surface with a
 * three-step label ramp. Which palette supplies those four values decides the
 * card's appearance, and the two built-in palettes answer differently: the
 * light palette derives them from its own elevation and label aliases so the
 * card reads as part of a light shell, while the dark palette pins the figma
 * neutral ramp instead of following its elevations. Both answers must stay
 * complete — a palette that names three of the four leaves the fourth to
 * inherit the other palette's value.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const platformCss = readFileSync(
  fileURLToPath(new URL('../src/styles/design-platform.css', import.meta.url)),
  'utf8',
)

/** The preview card's four component tokens, surface first. */
const CARD_TOKENS = [
  '--dsw-specific-hovercard-bg',
  '--dsw-specific-hovercard-label',
  '--dsw-specific-hovercard-label-secondary',
  '--dsw-specific-hovercard-label-tertiary',
] as const

/**
 * Declaration body of the rule matching `selector` that declares
 * `--dsw-alias-bg-layer-3`, which is how the two `body` palettes are told
 * apart from the static-scale block sharing the light selector.
 * @param selector - exact CSS selector text, regular-expression escaped by the caller.
 * @returns the declarations between that rule's braces.
 */
function paletteBlock(selector: string): string {
  const matches = [...platformCss.matchAll(new RegExp('(?:^|\\n)' + selector + ' \\{([^}]*)\\}', 'g'))]
  const block = matches.map(match => match[1] ?? '').find(body => body.includes('--dsw-alias-bg-layer-3:'))
  expect(block, selector + ' declares an alias palette').toBeDefined()
  return block ?? ''
}

/**
 * Declared value of one custom property in a rule body.
 * @param body - declaration body from {@link paletteBlock}.
 * @param token - custom property name, including the leading dashes.
 * @returns the trimmed value, or undefined when the body omits the property.
 */
function declared(body: string, token: string): string | undefined {
  return new RegExp('(?:^|\\s)' + token + ':\\s*([^;]+);').exec(body)?.[1]?.trim()
}

const light = paletteBlock('body')
const dark = paletteBlock('body\\[data-ds-dark-theme\\]')

describe('preview card palette contract', () => {
  it('derives the light palette card from that palette\'s own aliases', () => {
    expect(declared(light, '--dsw-specific-hovercard-bg')).toBe('var(--dsw-alias-bg-layer-3)')
    expect(declared(light, '--dsw-specific-hovercard-label')).toBe('var(--dsw-alias-label-primary)')
    expect(declared(light, '--dsw-specific-hovercard-label-secondary')).toBe('var(--dsw-alias-label-secondary)')
    expect(declared(light, '--dsw-specific-hovercard-label-tertiary')).toBe('var(--dsw-alias-label-tertiary)')
  })

  it('pins the dark palette card to the figma neutral ramp', () => {
    expect(declared(dark, '--dsw-specific-hovercard-bg')).toBe('var(--dsw-static-neutral-bluish-850)')
    expect(declared(dark, '--dsw-specific-hovercard-label')).toBe('var(--dsw-static-neutral-bluish-00)')
    expect(declared(dark, '--dsw-specific-hovercard-label-secondary')).toBe('var(--dsw-static-neutral-bluish-300)')
    expect(declared(dark, '--dsw-specific-hovercard-label-tertiary')).toBe('var(--dsw-static-neutral-bluish-400)')
  })

  it('leaves neither palette with an inherited token', () => {
    for (const token of CARD_TOKENS) {
      expect(declared(light, token), 'light ' + token).toBeDefined()
      expect(declared(dark, token), 'dark ' + token).toBeDefined()
    }
  })
})
