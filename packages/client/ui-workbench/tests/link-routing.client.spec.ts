// @vitest-environment jsdom
/**
 * The link gesture's rule, read as a function of the click. The regression this
 * guards is a viewport-shaped one: the handler used to reveal the pane only
 * above the phone breakpoint, so a tapped link loaded the site behind the
 * drawer the person was already in — indistinguishable from a dead link.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { handleDocumentLinkClick, type LinkClickHost } from '../src/client/link-routing.ts'

function host(): { link: LinkClickHost; openPane: Mock<(kind: 'browser', params: { url: string }) => void>; openDetails: Mock<() => void> } {
  const openPane = vi.fn<(kind: 'browser', params: { url: string }) => void>()
  const openDetails = vi.fn<() => void>()
  return { link: { openPane, openDetails }, openPane, openDetails }
}

/** One click event on an anchor rendered into the document. */
function clickOn(html: string): MouseEvent {
  document.body.innerHTML = html
  const anchor = document.body.querySelector('a')
  const event = new MouseEvent('click', { bubbles: true, cancelable: true })
  anchor?.dispatchEvent(event)
  // The delegated listener sees the anchor's own event; handing it back keeps
  // target resolution identical to the real document listener.
  return event
}

beforeEach(() => { document.body.innerHTML = '' })

describe('handleDocumentLinkClick', () => {
  it('routes a link into the browser pane and reveals it', () => {
    const { link, openPane } = host()
    const consumed = handleDocumentLinkClick(
      { target: document.body, preventDefault: vi.fn() } as unknown as MouseEvent,
      link,
    )
    expect(consumed).toBe(false)
    expect(openPane).not.toHaveBeenCalled()
  })

  it('reveals the pane on a phone, where the drawer is what covers it', () => {
    // innerWidth is the only thing that ever separated the two answers.
    const original = window.innerWidth
    window.innerWidth = 390
    try {
      const { link, openPane, openDetails } = host()
      const event = clickOn('<a href="https://example.com/docs">docs</a>')
      const consumed = handleDocumentLinkClick(event, link)
      expect(consumed).toBe(true)
      expect(event.defaultPrevented).toBe(true)
      expect(openPane).toHaveBeenCalledWith('browser', { url: 'https://example.com/docs' })
      expect(openDetails).toHaveBeenCalledTimes(1)
    } finally {
      window.innerWidth = original
    }
  })

  it('leaves non-link clicks alone', () => {
    const { link, openPane } = host()
    const event = clickOn('<button type="button">Send</button>')
    const consumed = handleDocumentLinkClick(event, link)
    expect(consumed).toBe(false)
    expect(event.defaultPrevented).toBe(false)
    expect(openPane).not.toHaveBeenCalled()
  })

  it('leaves non-http links alone', () => {
    const { link, openPane } = host()
    const event = clickOn('<a href="mailto:dev@example.com">mail</a>')
    expect(handleDocumentLinkClick(event, link)).toBe(false)
    expect(openPane).not.toHaveBeenCalled()
  })
})
