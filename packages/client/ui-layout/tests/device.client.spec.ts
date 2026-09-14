// @vitest-environment jsdom
/**
 * The one device ladder. Its whole reason to exist is that the shell used to
 * answer this question five times (1024, 768 three times, 720) and in fourteen
 * CSS breakpoints, so a tablet could be a phone to one rule and a desktop to
 * another. These cases are the ladder's contract: orientation-proof bands, and
 * input as a separate axis from size.
 */
import { describe, expect, it } from 'vitest'
import { classifyDevice, panesAreSheets, publishDevice } from '../src/client/device.ts'

describe('classifyDevice', () => {
  it('bands by the shortest side, so orientation is not a device change', () => {
    const portrait = classifyDevice(390, 844, true)
    const landscape = classifyDevice(844, 390, true)
    expect(portrait.class).toBe('phone')
    expect(landscape.class).toBe('phone')
    expect(portrait.orientation).toBe('portrait')
    expect(landscape.orientation).toBe('landscape')
  })

  it('keeps a large tablet a tablet, in both orientations', () => {
    expect(classifyDevice(834, 1112, true).class).toBe('tablet')
    expect(classifyDevice(1194, 834, true).class).toBe('tablet')
  })

  it('does not call a laptop a tablet just because it is short', () => {
    // The failure a width-only ladder makes: 1440x900 and 1194x834 differ by one
    // band, and only because the ladder reads the shortest side.
    expect(classifyDevice(1440, 900, false).class).toBe('laptop')
    expect(classifyDevice(1280, 800, false).class).toBe('laptop')
    expect(classifyDevice(1920, 1080, false).class).toBe('desktop')
    expect(classifyDevice(2560, 1440, false).class).toBe('desktop')
  })

  it('treats input as its own axis', () => {
    // An iPad Pro in landscape is 1366 wide — laptop-sized — and still has no
    // pointer. A layout that assumes a mouse there is wrong.
    const pro = classifyDevice(1366, 1024, true)
    expect(pro.class).toBe('laptop')
    expect(pro.input).toBe('touch')
  })

  it('says which devices cannot dock a pane', () => {
    expect(classifyDevice(390, 844, true).sheetPanes).toBe(true)
    expect(classifyDevice(834, 1112, true).sheetPanes).toBe(true)
    expect(classifyDevice(1194, 834, true).sheetPanes).toBe(false)
    expect(classifyDevice(1440, 900, false).sheetPanes).toBe(false)
  })
})

describe('publishDevice', () => {
  it('writes the answers a stylesheet or an immediate handler reads', () => {
    const root = document.createElement('div')
    publishDevice(root, classifyDevice(390, 844, true))
    expect(root.getAttribute('data-device')).toBe('phone')
    expect(root.getAttribute('data-input')).toBe('touch')
    expect(panesAreSheets(root)).toBe(true)

    publishDevice(root, classifyDevice(1440, 900, false))
    expect(panesAreSheets(root)).toBe(false)
  })

  it('reports docking when nothing has been published yet', () => {
    expect(panesAreSheets(document.createElement('div'))).toBe(false)
  })
})
