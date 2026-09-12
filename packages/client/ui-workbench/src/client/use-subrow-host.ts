/**
 * Live binding to the Workbench strip's second row.
 */

import { useEffect, useRef, useState } from 'react'

/** Id of the Workbench header row that panes portal their strip controls into. */
const SUBROW_HOST_ID = 'workbench-strip-subrow'

/**
 * Track the Workbench strip sub-row host while it exists.
 *
 * The host belongs to the Workbench header, not to the pane: it can mount after the
 * pane rendered, and it is replaced whenever the header remounts. A pane that keeps a
 * one-shot reference either renders its strip controls nowhere (the header was not in
 * the document yet) or portals them into a detached node, which renders nothing; both
 * look like the controls silently disappearing.
 * @returns the currently connected host element, or null while there is none.
 */
export function useSubrowHost(): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const hostRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const resolve = (): void => {
      if (hostRef.current !== null && hostRef.current.isConnected) return
      const next = document.getElementById(SUBROW_HOST_ID)
      if (next === hostRef.current) return
      hostRef.current = next
      setHost(next)
    }

    resolve()
    const observer = new MutationObserver(resolve)
    observer.observe(document.documentElement, { childList: true, subtree: true })
    return () => { observer.disconnect() }
  }, [])

  return host
}
