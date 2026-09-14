// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { BrowserPane, type BrowserPaneProps } from '../src/client/browser-pane.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh)

const props = (params: { url?: string }): BrowserPaneProps =>
  ({ params, t }) as unknown as BrowserPaneProps

const frame = (container: HTMLElement): HTMLIFrameElement =>
  container.querySelector('iframe') as HTMLIFrameElement

const addressBar = (): HTMLInputElement => screen.getByLabelText('地址') as HTMLInputElement

describe('BrowserPane', () => {
  it('loads the owner URL straight into the frame', () => {
    const view = render(<BrowserPane {...props({ url: 'https://example.com/docs' })} />)
    expect(frame(view.container).getAttribute('src')).toBe('https://example.com/docs')
    expect(addressBar().value).toBe('https://example.com/docs')
  })

  it('shows the blank prompt before any navigation', () => {
    const view = render(<BrowserPane {...props({})} />)
    expect(view.container.querySelector('iframe')).toBeNull()
    expect(screen.getByText('请输入地址。')).toBeDefined()
  })

  it('navigates from the address bar alone, with no live-view takeover', () => {
    // The pane used to adopt a Steel viewer endpoint: an owner-supplied stream
    // replaced the page, a takeover control drove it, and submitting a new
    // address re-broadcast the stale stream. The address bar is now the single
    // navigation source and the pane dispatches nothing.
    const opened: unknown[] = []
    const listener = (event: Event): void => { opened.push((event as CustomEvent).detail) }
    window.addEventListener('workbench:open-browser', listener)
    try {
      const view = render(<BrowserPane {...props({ url: 'https://example.com' })} />)
      fireEvent.change(addressBar(), { target: { value: 'https://example.org' } })
      fireEvent.submit(view.container.querySelector('form') as HTMLFormElement)
      expect(frame(view.container).getAttribute('src')).toBe('https://example.org')
      expect(opened).toEqual([])
      expect(screen.queryByText('接管控制')).toBeNull()
    } finally {
      window.removeEventListener('workbench:open-browser', listener)
    }
  })

  it('rejects a non-navigable address without touching the frame', () => {
    const view = render(<BrowserPane {...props({})} />)
    fireEvent.change(addressBar(), { target: { value: 'not a url' } })
    fireEvent.submit(view.container.querySelector('form') as HTMLFormElement)
    expect(screen.getByText('Invalid URL')).toBeDefined()
    expect(view.container.querySelector('iframe')).toBeNull()
  })
})
