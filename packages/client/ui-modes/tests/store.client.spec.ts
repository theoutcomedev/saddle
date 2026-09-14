// @vitest-environment jsdom
/**
 * Per-device-class memory: the classification boundaries, the switch record,
 * and the fact that one device class cannot overwrite another's shape.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createModesStore, deviceClassOf } from '../src/client/store.ts'

beforeEach(() => { localStorage.clear() })

describe('deviceClassOf', () => {
  it('splits at the sidebar auto-collapse and the drawer width', () => {
    expect(deviceClassOf(390)).toBe('phone')
    expect(deviceClassOf(768)).toBe('phone')
    expect(deviceClassOf(769)).toBe('tablet')
    expect(deviceClassOf(1024)).toBe('tablet')
    expect(deviceClassOf(1025)).toBe('desktop')
    expect(deviceClassOf(2560)).toBe('desktop')
  })
})

describe('the modes store', () => {
  it('remembers the switch and the mode it left', () => {
    const store = createModesStore().create('desktop')
    store.actions.setActive('zen')
    expect(store.getSnapshot()).toEqual({ active: 'zen', previous: 'standard' })
  })

  it('does not treat a repeated request as a switch', () => {
    // Otherwise the chip's one-click exit would leave a trail of fake history.
    const store = createModesStore().create('desktop')
    store.actions.setActive('zen')
    store.actions.setActive('zen')
    expect(store.getSnapshot()).toEqual({ active: 'zen', previous: 'standard' })
  })

  it('keeps one memory per device class', () => {
    createModesStore().create('phone').actions.setActive('zen')
    expect(createModesStore().create('phone').getSnapshot().active).toBe('zen')
    // The laptop is allowed to disagree with the phone.
    expect(createModesStore().create('desktop').getSnapshot().active).toBe('standard')
  })
})
