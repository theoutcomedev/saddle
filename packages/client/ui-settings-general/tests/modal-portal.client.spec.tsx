// @vitest-environment jsdom
/**
 * Overlay containment regression.
 *
 * The collapsed sidebar rail animates with a transform, and a transformed
 * ancestor becomes the containing block for `position: fixed` descendants — so
 * an overlay rendered in place was laid out inside the 49px rail and restyled by
 * it, which is the broken Deployments / Scheduled Tasks dialog users saw only
 * while the rail was collapsed. Each overlay renders through a portal, so
 * neither the containment nor the rail's own rules can reach it.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeployedAppsModal } from '../src/client/DeployedAppsModal.tsx'
import { ScheduledTasksModal } from '../src/client/ScheduledTasksModal.tsx'

afterEach(cleanup)

/** A rail-shaped host: transformed and narrow, exactly like the collapsed sidebar. */
function railHost(): HTMLDivElement {
  const host = document.createElement('div')
  host.style.transform = 'translateX(49px)'
  host.style.width = '49px'
  host.style.overflow = 'hidden'
  document.body.appendChild(host)
  return host
}

/** Snapshot hook stub reading one fixed state. */
const snapshotOf = (state: Record<string, unknown>) =>
  ((selector: (value: never) => unknown) => selector(state as never)) as never

describe('settings overlays', () => {
  it('portals the Deployments dialog out of the collapsed rail', () => {
    const host = railHost()
    const view = render(
      <DeployedAppsModal
        store={{ refresh: vi.fn(), startPolling: vi.fn(), stopPolling: vi.fn() } as never}
        useSnapshot={snapshotOf({ apps: [], loading: false, activeLogs: null, actionInFlight: null })}
        onClose={() => {}}
      />,
      { container: host },
    )
    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(host.contains(dialog)).toBe(false)
    view.unmount()
    host.remove()
  })

  it('portals the Scheduled Tasks dialog out of the collapsed rail', () => {
    const host = railHost()
    const view = render(
      <ScheduledTasksModal
        store={{
          refresh: vi.fn(),
          startPolling: vi.fn(),
          stopPolling: vi.fn(),
          listSessions: vi.fn(async () => []),
          listWorkspaces: vi.fn(async () => []),
        } as never}
        useSnapshot={snapshotOf({ tasks: [], activeLogs: null, actionInFlight: null })}
        onClose={() => {}}
      />,
      { container: host },
    )
    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(host.contains(dialog)).toBe(false)
    view.unmount()
    host.remove()
  })
})
