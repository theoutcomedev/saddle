/**
 * The document-level link gesture, kept out of the component so the rule is a
 * function of the click alone. A clicked http(s) anchor is opened in the
 * Browser pane and the pane is revealed — on every viewport. A tap is as
 * deliberate a gesture as a click, so a phone must not get a different answer:
 * the site the person asked for is what they should be looking at, and hiding
 * it behind the drawer they were already in reads as the link having failed.
 */

/** What the handler needs from the Workbench: two ways to show something. */
export interface LinkClickHost {
  /**
   * Open a pane with instance params.
   * @param kind - the pane kind to open.
   * @param params - the pane's instance params (the target URL here).
   */
  openPane: (kind: 'browser', params: { url: string }) => void
  /** Reveal the pane: the dock on a wide screen, the drawer on a phone. */
  openDetails: () => void
}

/**
 * Handle one document click: route an http(s) link into the Browser pane.
 * @param event - the click event (prevented and routed when it names a link).
 * @param host - the Workbench's two ways to show something.
 * @returns true when the click was a link this handler consumed.
 */
export function handleDocumentLinkClick(event: MouseEvent, host: LinkClickHost): boolean {
  const target = event.target as HTMLElement | null
  const anchor = target?.closest('a[href^="http"]') as HTMLAnchorElement | null
  if (anchor === null || anchor === undefined) return false
  const href = anchor.getAttribute('href')
  if (href === null) return false
  event.preventDefault()
  host.openPane('browser', { url: href })
  host.openDetails()
  return true
}
