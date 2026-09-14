/**
 * The session-header preset chip's box, read as CSS text. jsdom has no layout,
 * so the component specs pin the chip's text but not whether it is padded
 * around its icon or clips a long name with an ellipsis; these read the
 * declarations that geometry depends on.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  fileURLToPath(new URL('../src/client/AgentPresetLabel.module.css', import.meta.url)),
  'utf8',
)
/** Declarations only: the sheet's prose names the properties it explains. */
const declarationText = css.replace(/\/\*[\s\S]*?\*\//g, ' ')

function declarations(selector: string): string[] {
  // Anchored at a rule boundary, so a compound rule that merely contains the
  // selector cannot silently satisfy the assertion.
  const rule = new RegExp(`(?:^|\\})\\s*\\${selector}\\s*\\{([^{}]*)\\}`).exec(declarationText)
  if (rule === null) throw new Error(`AgentPresetLabel.module.css has no \`${selector}\` rule`)
  return (rule[1] ?? '').split(';').map(part => part.trim()).filter(Boolean)
}

describe('AgentPresetLabel.module.css chip', () => {
  it('pads the chip on both sides of its icon and name', () => {
    // `padding: 0 2px 0 0` left the icon against the rounded left corner and the
    // name against the right one, so the chip read as a clipped box.
    expect(declarations('.label')).toContain('padding: 0 8px')
  })

  it('keeps the chip one line tall and unbroken', () => {
    expect(declarations('.label')).toEqual(expect.arrayContaining([
      'display: inline-flex',
      'align-items: center',
      'height: 22px',
      'white-space: nowrap',
    ]))
    // The icon is a fixed 14px mark; a shrinkable one would squash under a long
    // preset name instead of letting the name ellipsize.
    expect(declarations('.icon')).toContain('flex: none')
  })

  it('leaves the truncation to the name inside the chip', () => {
    // A flex container clips its anonymous text box without drawing an
    // ellipsis, so the name child owns overflow and the ellipsis.
    expect(declarations('.name')).toEqual(expect.arrayContaining([
      'min-width: 0',
      'overflow: hidden',
      'white-space: nowrap',
      'text-overflow: ellipsis',
    ]))
    expect(declarations('.label')).not.toContain('text-overflow: ellipsis')
  })
})
