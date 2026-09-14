/**
 * The catalogue is the client half of a two-sided contract: the host package
 * owns the ids its tool accepts, this package owns what each id arranges.
 * These read the pair together, because a drift between them is a mode the
 * picker offers as a blank or an id the tool accepts and nothing can show.
 */
import { describe, expect, it } from 'vitest'
import { WORKSPACE_MODES } from '@deepseek-ai/dsh-workspace-modes'
import { DEFAULT_MODE, MODE_ARRANGEMENTS, MODE_ORDER } from '../src/client/catalogue.ts'

describe('the mode catalogue', () => {
  it('offers exactly the modes the host tool accepts', () => {
    expect([...MODE_ORDER].sort()).toEqual([...WORKSPACE_MODES].sort())
  })

  it('leads with the plain arrangement, which is also the default', () => {
    expect(MODE_ORDER[0]).toBe(DEFAULT_MODE)
  })

  it('names each panel shape rather than a width', () => {
    // The width contract lives in ui-layout's columns: a recipe that carried
    // pixels would rebuild the shell's geometry in a second place.
    for (const mode of MODE_ORDER) {
      const arrangement = MODE_ARRANGEMENTS[mode]
      expect(['closed', 'default', 'wide']).toContain(arrangement.sidebar)
      expect(['closed', 'default', 'wide']).toContain(arrangement.details)
    }
  })
})
