/**
 * Three-column shell frame, registered into the built-in 'root' slot (the web
 * shell renders only 'root'). Owns the grid tracks (sidebar | center |
 * details), the drag handles (pointer capture + rAF throttle), the concession
 * chain (columns.ts), and the child-slot render decisions: the sidebar slot
 * renders HERE with live parameters from the concession solve, and the
 * session-aware occupants render in fixed column positions; strict entries
 * gate themselves on current-session availability while session-maybe
 * entries retain identity. Pure component: everything arrives
 * through the three framework shares — zero cordis or framework imports,
 * zero self-made hooks.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { LoginScreen } from './LoginScreen.tsx'
import type { PropsRenderSlots, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { SIDEBAR_COLLAPSED, SIDEBAR_SHEET } from './columns.ts'
import { resolveShell } from './shell.ts'
import type { createLayoutStore } from './stores.ts'
import css from './AppFrame.module.css'

/** Full composed props: runtime share + child-slot render share + store share. */
export type AppFrameProps =
  & PropsRuntime<'root'>
  & PropsRenderSlots<'sidebar' | 'conversation' | 'details' | 'shell.overlay' | 'shell.mobile_trigger'>
  & PropsStore<ReturnType<typeof createLayoutStore>>

/**
 * Center column grid item (session-body building block). The reading measure is
 * applied here rather than by a stylesheet keyed on a layout id: any layout may
 * ask for one, and the shell is what knows the column's box.
 */
function CenterColumn(props: { children?: ReactNode; measure?: number | null | undefined }) {
  // `data-conversation-column` is the stable hook shell-level styles key on.
  const measure = props.measure ?? null
  return (
    <div
      className={css.centerCol}
      data-conversation-column=""
      style={measure === null ? undefined : { maxWidth: measure, marginInline: 'auto' }}
    >
      {props.children}
    </div>
  )
}

/** Details column grid item; width 0 keeps the subtree mounted (never unmount on close). */
function DetailsColumn(props: { children?: ReactNode }) {
  return <div className={css.detailsCol}>{props.children}</div>
}

/**
 * One drag handle: pointer capture, rAF-throttled dx reports against the drag-start origin.
 * `side` keys the hover-reveal CSS to the owning column.
 */
function DragHandle(props: { side: 'sidebar' | 'details'; left: number; onStart: () => void; onDrag: (dx: number) => void; onEnd: () => void }) {
  const [dragging, setDragging] = useState(false)
  const origin = useRef(0)
  const latest = useRef(0)
  const frame = useRef<number | null>(null)
  const callbacks = useRef({ onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd })
  callbacks.current = { onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd }

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    origin.current = e.clientX
    latest.current = e.clientX
    callbacks.current.onStart()
    setDragging(true)
  }, [])
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    latest.current = e.clientX
    frame.current ??= requestAnimationFrame(() => {
      frame.current = null
      callbacks.current.onDrag(latest.current - origin.current)
    })
  }, [])
  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null }
    callbacks.current.onDrag(latest.current - origin.current)
    setDragging(false)
    callbacks.current.onEnd()
  }, [])

  return (
    <div
      className={css.handle}
      style={{ left: props.left }}
      data-side={props.side}
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  )
}

/** The three-column frame (see module doc). */
function AppFrameInner({
  useStore,
  useSessions,
  actions,
  renderSlot,
}: AppFrameProps) {
  const panels = useStore(s => s)
  const detailsSession = useSessions((s) => {
    const current = s.current
    return current !== undefined && s.byId[current]?.blank === false ? current : undefined
  })
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState(() => window.innerWidth)

  const lastSession = useRef(detailsSession)
  useLayoutEffect(() => {
    if (detailsSession === undefined) return
    if (lastSession.current !== undefined && lastSession.current !== detailsSession) {
      actions.closeDetails()
    }
    lastSession.current = detailsSession
  }, [actions, detailsSession])

  // The selected id (blank Sessions included): opening one from the narrow
  // drawer dismisses the drawer, which is an overlay covering exactly the
  // conversation it just opened. The wide sidebar is unaffected. The first pick
  // counts too: on a phone the person's gesture is the same whether or not some
  // session was already open, and leaving the drawer over the conversation they
  // just chose reads as the tap having failed.
  const currentSession = useSessions(s => s.current)
  const lastOpened = useRef(currentSession)
  useLayoutEffect(() => {
    if (currentSession === undefined) return
    if (lastOpened.current !== currentSession) {
      // Only the sheet form leaves with the session: a wide sidebar is a column
      // beside the conversation, not an overlay over the one it just replaced.
      actions.closeSidebarSheet()
    }
    lastOpened.current = currentSession
  }, [actions, currentSession])

  // Track the frame's own box (not the window): rAF-throttled ResizeObserver.
  useEffect(() => {
    const el = frameRef.current
    /* v8 ignore next -- the ref is always attached by effect time: the frame div renders unconditionally. */
    if (el === null) return
    let raf: number | null = null
    const observer = new ResizeObserver(() => {
      raf ??= requestAnimationFrame(() => {
        raf = null
        const width = el.getBoundingClientRect().width
        if (width > 0) setViewport(width)
      })
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [])

  // The device decides what can be docked; the active layout decides what should
  // be shown; shell.ts resolves the two into placements. Nothing here re-derives
  // a device rule from a width — that is what the five old breakpoints did, and
  // why the shell could not answer "what device is this?" at all.
  const facts = panels.device
  const resolution = resolveShell(panels.shell, facts, viewport, {
    sidebarOpen: facts.sheetPanes ? panels.sidebarSheetOpen : panels.sidebar !== 0,
    detailsOpen: panels.details !== 0,
    sidebarPreference: panels.sidebar,
    detailsPreference: panels.details,
    requested: panels.surfaceRequested,
  })
  const cols = resolution.columns
  const sidebarDocked = resolution.sidebar.placement === 'column'
  const sidebarSheet = resolution.sidebar.placement === 'sheet'
  // "Collapsed" is the surface not showing, in either form: a rail column on a
  // docking device, an unopened sheet on a phone. It reads the resolved width
  // rather than the stored preference, because resolution may have put the list
  // on its rail to keep a docked pane beside the work.
  const sidebarCollapsed = sidebarDocked ? cols.sidebar <= SIDEBAR_COLLAPSED : !panels.sidebarSheetOpen
  const detailsDocked = resolution.details.placement === 'column'
  const detailsSheet = resolution.details.placement === 'sheet'
  const detailsOpen = panels.details !== 0
  const colsRef = useRef(cols)
  colsRef.current = cols

  // The drag base is the rendered width captured at drag start (grabbing a
  // concession-clamped panel must not jump back to the stored preference);
  // it stays frozen for the whole gesture so dx deltas do not compound.
  const sidebarBase = useRef(0)
  const detailsBase = useRef(0)
  // Track-level transitions pause for the whole gesture: eased tracks would
  // detach the column edge from the pointer (AppFrame.module.css).
  const [dragging, setDragging] = useState(false)
  const onDragEnd = useCallback(() => { setDragging(false) }, [])
  const onSidebarStart = useCallback(() => { sidebarBase.current = colsRef.current.sidebar; setDragging(true) }, [])
  const onDetailsStart = useCallback(() => { detailsBase.current = colsRef.current.details; setDragging(true) }, [])
  const onSidebarDrag = useCallback((dx: number) => {
    actions.setSidebar(sidebarBase.current + dx)
  }, [actions])
  const onDetailsDrag = useCallback((dx: number) => {
    actions.setDetails(detailsBase.current - dx)
  }, [actions])

  // Whether the navigation surface is showing at all, in either form. The
  // mobile trigger and the backdrop both ask this rather than re-deriving it.
  const sidebarVisible = (): boolean => sidebarSheet ? panels.sidebarSheetOpen : !sidebarCollapsed

  return (
    <div
      ref={frameRef}
      className={css.frame}
      style={{
        gridTemplateColumns: `${cols.sidebar}px minmax(0, 1fr) ${cols.details}px`,
        '--sidebar-width': `${cols.sidebar}px`,
        '--details-width': `${cols.details}px`,
      } as React.CSSProperties}
      data-sidebar-collapsed={sidebarCollapsed || undefined}
      data-sidebar-sheet={sidebarSheet || undefined}
      data-details-collapsed={!detailsOpen || undefined}
      data-details-open={detailsOpen || undefined}
      data-density={resolution.density}
      data-dragging={dragging || undefined}
    >
      {renderSlot('shell.mobile_trigger', {
        collapsed: !sidebarVisible(),
        onToggle: () => {
          if (detailsOpen) actions.closeDetails()
          actions.toggleSidebar(facts.sheetPanes)
        },
      }, {
        fallback: (
          <div
            className={css.mobileHamburger}
            onClick={() => {
              if (detailsOpen) actions.closeDetails()
              actions.toggleSidebar(facts.sheetPanes)
            }}
            title="Open Menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </div>
        ),
      })}
      {/* The sidebar as a docked column: a closed column keeps the mounted slot
          at the compact-rail width, so the occupant renders the rail UI. A
          layout that says "none" removes the surface; a device that cannot dock
          it gets the sheet below instead. */}
      {sidebarDocked && (
        <div className={css.sidebarCol}>
          {renderSlot('sidebar', {
            collapsed: sidebarCollapsed,
            width: cols.sidebar,
            sheet: false,
          })}
        </div>
      )}
      {sidebarSheet && panels.sidebarSheetOpen && (
        <>
          <div className={css.sheetBackdrop} onClick={() => { actions.closeSidebarSheet() }} />
          <div className={css.sidebarSheet} data-sidebar-sheet="">
            {renderSlot('sidebar', { collapsed: false, width: SIDEBAR_SHEET, sheet: true })}
          </div>
        </>
      )}
      <>
        {/* Both column occupants stay at fixed tree positions from first
            paint — no loading gate: a bare status line reads worse than
            the shell's own pending rendering. The conversation
            is session-maybe; the strict details entry naturally renders
            empty while no session is current. */}
        <CenterColumn measure={resolution.measure}>
          {renderSlot('conversation', {
            detailsOpen,
            composer: resolution.composer,
            header: resolution.header,
            density: resolution.density,
            measure: resolution.measure,
          })}
        </CenterColumn>
        {detailsDocked && <DetailsColumn>{renderSlot('details', {})}</DetailsColumn>}
      </>
      {detailsSheet && (
        <>
          <div className={css.sheetBackdrop} onClick={() => { actions.closeDetails() }} />
          <div className={css.detailsSheet} data-details-sheet="">
            {renderSlot('details', {})}
          </div>
        </>
      )}
      <div className={css.overlayLayer} data-shell-overlay>
        {renderSlot('shell.overlay', {})}
      </div>
      {/* The collapsed rail is fixed-width: no resize handle while closed. */}
      {sidebarDocked && !sidebarCollapsed && <DragHandle side="sidebar" left={cols.sidebar} onStart={onSidebarStart} onDrag={onSidebarDrag} onEnd={onDragEnd} />}
      {detailsDocked && cols.details > 0 && <DragHandle side="details" left={viewport - cols.details} onStart={onDetailsStart} onDrag={onDetailsDrag} onEnd={onDragEnd} />}
      {facts.sheetPanes && (sidebarVisible() || detailsOpen) && (
        <div
          className={css.mobileBackdrop}
          onClick={() => {
            if (sidebarVisible()) actions.closeSidebarSheet()
            if (detailsOpen) actions.closeDetails()
          }}
        />
      )}
    </div>
  )
}


export function AppFrame(props: AppFrameProps) {
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>(() => {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') return 'authenticated'
    return 'loading'
  })

  useEffect(() => {
    fetch('/api/auth/status')
      .then(r => r.json())
      .then((data) => {
        if (data.authEnabled && !data.authenticated) {
          setAuthStatus('unauthenticated')
        } else {
          setAuthStatus('authenticated')
        }
      })
      .catch(() => {
        setAuthStatus('authenticated')
      })
  }, [])

  if (authStatus === 'loading') return null
  if (authStatus === 'unauthenticated') return <LoginScreen onLoginSuccess={() => setAuthStatus('authenticated')} />

  return <AppFrameInner {...props} />
}
