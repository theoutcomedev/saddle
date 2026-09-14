// @vitest-environment jsdom
/**
 * Per-device-class memory: one device class cannot overwrite another's shape,
 * and following the class is what keeps a resized window's picker honest — the
 * shapes a phone is offered are not the shapes a laptop is offered.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createLayoutsStore } from '../src/client/store.ts'

beforeEach(() => { localStorage.clear() })

describe('the layouts store', () => {
  it('starts on the default arrangement, remembering nothing yet', () => {
    const store = createLayoutsStore().create()
    expect(store.getSnapshot()).toEqual({ active: 'default', device: 'desktop', remembered: {} })
  })

  it('remembers a switch on the device class it was made on', () => {
    const store = createLayoutsStore().create()
    store.actions.setActive('zen')
    expect(store.getSnapshot()).toEqual({ active: 'zen', device: 'desktop', remembered: { desktop: 'zen' } })
  })

  it('does not treat a repeated request as a switch', () => {
    const store = createLayoutsStore().create()
    store.actions.setActive('zen')
    store.actions.setActive('zen')
    expect(store.getSnapshot().remembered).toEqual({ desktop: 'zen' })
  })

  it('keeps one memory per device class and takes it up on the way back', () => {
    const store = createLayoutsStore().create()
    store.actions.setActive('zen')

    store.actions.setDeviceClass('phone')
    // The phone has chosen nothing, so it gets the plain arrangement rather than
    // the laptop's Zen Writer.
    expect(store.getSnapshot()).toMatchObject({ active: 'default', device: 'phone' })
    store.actions.setActive('capture')

    store.actions.setDeviceClass('desktop')
    expect(store.getSnapshot()).toMatchObject({ active: 'zen', device: 'desktop' })
    store.actions.setDeviceClass('phone')
    expect(store.getSnapshot()).toMatchObject({ active: 'capture', device: 'phone' })
    expect(store.getSnapshot().remembered).toEqual({ desktop: 'zen', phone: 'capture' })
  })

  it('ignores a repeat of the class it already follows', () => {
    const store = createLayoutsStore().create()
    store.actions.setActive('wall')
    store.actions.setDeviceClass('desktop')
    expect(store.getSnapshot()).toMatchObject({ active: 'wall', remembered: { desktop: 'wall' } })
  })

  it('survives a reload with the class it was left on', () => {
    createLayoutsStore().create().actions.setDeviceClass('phone')
    const reloaded = createLayoutsStore().create()
    expect(reloaded.getSnapshot()).toMatchObject({ device: 'phone', active: 'default' })
  })
})
