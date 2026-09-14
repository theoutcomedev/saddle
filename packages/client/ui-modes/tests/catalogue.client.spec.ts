/**
 * The catalogue is the client half of a two-sided contract: the host package
 * owns the ids its tool accepts, this package owns what each id arranges.
 * These read the pair together, because a drift between them is a layout the
 * picker offers as a blank or an id the tool accepts and nothing can show.
 */
import { describe, expect, it } from 'vitest'
import { WORKSPACE_LAYOUTS } from '@deepseek-ai/dsh-workspace-modes'
import { DEFAULT_LAYOUT, LAYOUT_ARRANGEMENTS, LAYOUT_ORDER } from '../src/client/catalogue.ts'

describe('the layout catalogue', () => {
  it('offers exactly the layouts the host tool accepts', () => {
    expect([...LAYOUT_ORDER].sort()).toEqual([...WORKSPACE_LAYOUTS].sort())
  })

  it('leads with the plain arrangement, which is also the default', () => {
    expect(LAYOUT_ORDER[0]).toBe(DEFAULT_LAYOUT)
  })

  it('names each panel shape rather than a width', () => {
    // The width contract lives in ui-layout's columns: a recipe that carried
    // pixels would rebuild the shell's geometry in a second place.
    for (const layout of LAYOUT_ORDER) {
      const arrangement = LAYOUT_ARRANGEMENTS[layout]
      expect(['closed', 'default', 'wide']).toContain(arrangement.sidebar)
      expect(['closed', 'default', 'wide']).toContain(arrangement.details)
    }
  })
})
