/**
 * The catalogue is the client half of a two-sided contract: the host package
 * owns the ids its tool accepts, this package owns what each id specifies. These
 * read the pair together — a drift is a layout the picker offers as a blank, or
 * an id the tool accepts and nothing can render — and they pin the device
 * scoping that makes a phone's picker list phone jobs.
 */
import { describe, expect, it } from 'vitest'
import { WORKSPACE_LAYOUTS } from '@deepseek-ai/dsh-workspace-modes'
import { DEFAULT_LAYOUT, LAYOUTS, LAYOUT_ORDER, layoutsFor } from '../src/client/catalogue.ts'

describe('the layout catalogue', () => {
  it('specifies exactly the layouts the host tool accepts', () => {
    expect([...LAYOUT_ORDER].sort()).toEqual([...WORKSPACE_LAYOUTS].sort())
  })

  it('leads with the plain arrangement, which is also the default', () => {
    expect(LAYOUT_ORDER[0]).toBe(DEFAULT_LAYOUT)
    expect(LAYOUTS[DEFAULT_LAYOUT].devices).toContain('phone')
    expect(LAYOUTS[DEFAULT_LAYOUT].devices).toContain('desktop')
  })

  it('names placements and chrome rather than widths', () => {
    for (const id of LAYOUT_ORDER) {
      const { spec } = LAYOUTS[id]
      expect(['column', 'sheet', 'none']).toContain(spec.sidebar)
      expect(['column', 'sheet', 'none']).toContain(spec.details)
      expect(['full', 'compact']).toContain(spec.header)
      expect(['full', 'minimal', 'none']).toContain(spec.composer)
      expect(['compact', 'comfortable', 'roomy']).toContain(spec.density)
    }
  })

  it('offers each device the jobs that device is for', () => {
    // A phone lists phone shapes, a desktop never offers a counter posture.
    expect(layoutsFor('phone')).toEqual(['default', 'capture', 'read', 'focus'])
    expect(layoutsFor('tablet')).toEqual(['default', 'focus', 'zen', 'workbench', 'counter'])
    expect(layoutsFor('laptop')).toEqual(['default', 'focus', 'zen', 'workbench', 'studio'])
    expect(layoutsFor('desktop')).toEqual(['default', 'focus', 'zen', 'workbench', 'studio', 'wall'])
  })

  it('gives every layout at least one device, in every device it claims', () => {
    for (const id of LAYOUT_ORDER) {
      expect(LAYOUTS[id].devices.length).toBeGreaterThan(0)
      for (const device of LAYOUTS[id].devices) {
        expect(layoutsFor(device)).toContain(id)
      }
    }
  })
})
