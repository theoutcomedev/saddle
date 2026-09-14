// @vitest-environment jsdom
/**
 * Per-device-class memory: the classification boundaries, the switch record,
 * and the fact that one device class cannot overwrite another's shape.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createLayoutsStore, deviceClassOf } from '../src/client/store.ts'

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

describe('the layouts store', () => {
  it('remembers the switch and the layout it left', () => {
    const store = createLayoutsStore().create('desktop')
    store.actions.setActive('zen')
    expect(store.getSnapshot()).toEqual({ active: 'zen', previous: 'default' })
  })

  it('does not treat a repeated request as a switch', () => {
    // Otherwise the chip's one-click exit would leave a trail of fake history.
    const store = createLayoutsStore().create('desktop')
    store.actions.setActive('zen')
    store.actions.setActive('zen')
    expect(store.getSnapshot()).toEqual({ active: 'zen', previous: 'default' })
  })

  it('keeps one memory per device class', () => {
    createLayoutsStore().create('phone').actions.setActive('zen')
    expect(createLayoutsStore().create('phone').getSnapshot().active).toBe('zen')
    // The laptop is allowed to disagree with the phone.
    expect(createLayoutsStore().create('desktop').getSnapshot().active).toBe('default')
  })
})
