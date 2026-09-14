// @vitest-environment jsdom
/**
 * The mounted canvas's own maximize.
 *
 * The maximized rule is `position: fixed` with `inset: 0`, which only covers the
 * viewport while the element has no transformed ancestor: the details column
 * carries `transform: translateY(100%)` on a narrow viewport, and a transform
 * makes an element the containing block for its fixed descendants, so the panel
 * would resolve against that column and be clipped by it. The canvas therefore
 * portals the maximized element onto the body, and this spec mounts it inside
 * exactly that trap. Body-level position is what is asserted: an element that
 * merely appears somewhere under `body` proves nothing.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MetamorphicCanvas } from '../src/client/MetamorphicCanvas.tsx'
import css from '../src/client/MetamorphicCanvas.module.css'

const FILES = { '/App.tsx': 'export default function App() { return null }' }

const maximizedClass = css.maximized
const rootClass = css.root
if (maximizedClass === undefined || rootClass === undefined) {
  throw new Error('maximized/root classes missing from MetamorphicCanvas.module.css')
}

/** The canvas node the frame owns directly, or null when it lives elsewhere. */
const onBody = (className: string): Element | null => document.body.querySelector(`:scope > .${className}`)

/** Mount the docked canvas inside a transformed, clipping host, as the column is. */
function mountInColumnTrap(): { host: HTMLElement } {
  const host = document.createElement('div')
  host.style.transform = 'translateY(100%)'
  host.style.overflow = 'hidden'
  document.body.append(host)
  render(<MetamorphicCanvas title="Portal probe" files={FILES} />, { container: host })
  return { host }
}

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

describe('MetamorphicCanvas maximize', () => {
  it('starts inside the column it was mounted into', () => {
    const { host } = mountInColumnTrap()
    expect(host.querySelector(`.${rootClass}`)).not.toBeNull()
    expect(host.querySelector('iframe')).not.toBeNull()
    expect(onBody(rootClass)).toBeNull()
  })

  it('moves the maximized canvas onto the body, out of the transformed column', () => {
    const { host } = mountInColumnTrap()
    fireEvent.click(screen.getByLabelText('Maximize in Workbench'))

    // Inside the column the fixed rule would resolve against the column itself.
    expect(host.querySelector('iframe')).toBeNull()
    const portaled = onBody(maximizedClass)
    expect(portaled).not.toBeNull()
    expect(portaled?.parentElement).toBe(document.body)
    expect((portaled as Element).querySelector('iframe')).not.toBeNull()
  })

  it('puts the canvas back in place when the view is restored', () => {
    const { host } = mountInColumnTrap()
    fireEvent.click(screen.getByLabelText('Maximize in Workbench'))
    // The restore control lives in the portaled node, so query the document.
    fireEvent.click(screen.getByLabelText('Restore View'))

    expect(onBody(maximizedClass)).toBeNull()
    expect(host.querySelector(`.${rootClass}`)).not.toBeNull()
    expect(host.querySelector('iframe')).not.toBeNull()
  })
})
