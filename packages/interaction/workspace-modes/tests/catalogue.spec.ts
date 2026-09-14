/**
 * The catalogue is the contract between what the model may ask for and what
 * the browser package can arrange: the tool's enum and description are derived
 * from it, so an id without a purpose, or a purpose without an id, is a hole
 * the description would paper over.
 */
import { describe, expect, it } from 'vitest'
import { WORKSPACE_MODES, WORKSPACE_MODE_PURPOSES } from '../src/catalogue.ts'

describe('the workspace-mode catalogue', () => {
  it('describes every mode it accepts, and nothing else', () => {
    expect(Object.keys(WORKSPACE_MODE_PURPOSES).sort()).toEqual([...WORKSPACE_MODES].sort())
  })

  it('lists the plain arrangement first', () => {
    expect(WORKSPACE_MODES[0]).toBe('standard')
  })

  it('gives every mode a distinct id and a sentence', () => {
    expect(new Set(WORKSPACE_MODES).size).toBe(WORKSPACE_MODES.length)
    for (const mode of WORKSPACE_MODES) {
      expect(WORKSPACE_MODE_PURPOSES[mode].length).toBeGreaterThan(20)
    }
  })
})
