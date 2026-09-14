/**
 * The catalogue is the contract between what the model may ask for and what
 * the browser package can arrange: the tool's enum and description are derived
 * from it, so an id without a purpose, or a purpose without an id, is a hole
 * the description would paper over.
 */
import { describe, expect, it } from 'vitest'
import { WORKSPACE_LAYOUTS, WORKSPACE_LAYOUT_PURPOSES } from '../src/catalogue.ts'

describe('the workspace-layout catalogue', () => {
  it('describes every layout it accepts, and nothing else', () => {
    expect(Object.keys(WORKSPACE_LAYOUT_PURPOSES).sort()).toEqual([...WORKSPACE_LAYOUTS].sort())
  })

  it('lists the plain arrangement first', () => {
    expect(WORKSPACE_LAYOUTS[0]).toBe('default')
  })

  it('gives every layout a distinct id and a sentence', () => {
    expect(new Set(WORKSPACE_LAYOUTS).size).toBe(WORKSPACE_LAYOUTS.length)
    for (const layout of WORKSPACE_LAYOUTS) {
      expect(WORKSPACE_LAYOUT_PURPOSES[layout].length).toBeGreaterThan(20)
    }
  })
})
