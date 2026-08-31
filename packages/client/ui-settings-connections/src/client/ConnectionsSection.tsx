/**
 * Connections settings section: every registered service flow with its
 * credential state, the connect dialog that walks an attempt, and the live
 * MCP server status card. The list is fetched on mount and after every
 * committed connect or disconnect; nothing here subscribes — the section is a
 * settings page, not a live dashboard.
 */

import { useEffect, useState } from 'react'
import type { IConnections } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  ConnectionFlowView, ConnectionsListValue, McpServerView,
} from '@deepseek-ai/dsh-api-remotes/client'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import { ConnectDialog } from './ConnectDialog.tsx'
import { logoColor, logoSvgPath } from './logos.ts'
import type { ConnectionsKey } from './locales.ts'
import css from './ConnectionsSection.module.css'

/** Injected dependencies of {@link ConnectionsSection} (slot inject). */
export interface ConnectionsSectionInjected {
  /** The connections service face (wire walk). */
  connections: IConnections
  /** Section copy. */
  t: (key: ConnectionsKey) => string
}

/** Props delivered by the slot outlet: the inject face spread flat. */
export type ConnectionsSectionProps = Partial<InjectFace<ConnectionsSectionInjected>>

/** The list phase drives the whole section body. */
type SectionPhase = 'loading' | 'ready' | 'error'

/** Render one flow's connect action label. */
function methodLabel(key: string, t: (key: ConnectionsKey) => string): string {
  if (key === 'api-key') return t('methodApiKey')
  if (key === 'device') return t('methodDevice')
  if (key === 'oauth') return t('methodOauth')
  return key
}

/** Render one MCP server's status label. */
function mcpStatusLabel(server: McpServerView, t: (key: ConnectionsKey) => string): string {
  if (server.state === 'ready') return t('mcpReady')
  if (server.state === 'connecting') return t('mcpConnecting')
  if (server.state === 'failed') return t('mcpFailed')
  return t('mcpClosed')
}

/** A stable monogram color from a service label (no bundled logo assets needed). */
function monogramColor(label: string): string {
  let hash = 0
  for (let i = 0; i < label.length; i += 1) hash = (hash * 31 + label.charCodeAt(i)) | 0
  const palette = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#ec4899']
  return palette[Math.abs(hash) % palette.length] ?? '#6b7280'
}

/** The first letter of a service label for its monogram. */
function initialOf(label: string): string {
  return label.trim().charAt(0).toUpperCase() || '?'
}

/** The service id segment of a connection key (connections/twilio -> twilio). */
function serviceIdOf(key: string): string {
  const slash = key.lastIndexOf('/')
  return slash === -1 ? key : key.slice(slash + 1)
}

/** Render the brand logo on a brand-color badge, or the monogram fallback. */
function renderLogo(key: string, label: string) {
  const id = serviceIdOf(key)
  const path = logoSvgPath(id)
  const background = logoColor(id) ?? monogramColor(label)
  if (path !== undefined) {
    return (
      <span className={css.logo} aria-hidden="true" style={{ background }}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff" role="img" aria-hidden="true">
          <path d={path} />
        </svg>
      </span>
    )
  }
  return <span className={css.logo} aria-hidden="true" style={{ background }}>{initialOf(label)}</span>
}

/** Render the Connections page. */
export function ConnectionsSection({ connections, t }: ConnectionsSectionProps) {
  const [phase, setPhase] = useState<SectionPhase>('loading')
  const [error, setError] = useState('')
  const [data, setData] = useState<ConnectionsListValue>({ flows: [], mcp: [] })
  const [connectFlow, setConnectFlow] = useState<ConnectionFlowView | undefined>(undefined)
  const [confirming, setConfirming] = useState<ConnectionFlowView | undefined>(undefined)
  const [disconnecting, setDisconnecting] = useState(false)

  const load = async (): Promise<void> => {
    if (connections === undefined) return
    try {
      const result = await connections.list()
      if (!result.ok) {
        setPhase('error')
        setError(result.error.message)
        return
      }
      setData(result.value)
      setPhase('ready')
    } catch (error: unknown) {
      setPhase('error')
      setError(error instanceof Error ? error.message : String(error))
    }
  }

  useEffect(() => {
    if (connections === undefined) return
    void load()
  }, [connections])

  const runDisconnect = async (flow: ConnectionFlowView): Promise<void> => {
    if (connections === undefined || t === undefined) return
    setDisconnecting(true)
    const result = await connections.disconnect(flow.key)
    setDisconnecting(false)
    setConfirming(undefined)
    if (!result.ok) {
      setError(t('disconnectFailed').replace('{message}', result.error.message))
      return
    }
    setError('')
    void load()
  }

  if (connections === undefined || t === undefined) {
    return (
      <div className={css.section}>
        <h2 className={css.title}>{t === undefined ? 'Connections' : t('title')}</h2>
        <p className={css.error}>{t === undefined ? 'Connections are unavailable in this build.' : t('loadFailed')}</p>
      </div>
    )
  }

  return (
    <div className={css.section}>
      <h2 className={css.title}>{t('title')}</h2>
      <p className={css.intro}>{t('intro')}</p>

      {phase === 'loading' && <p className={css.waiting}>{t('connecting')}</p>}
      {phase === 'error' && <p className={css.error}>{t('loadFailed')}: {error}</p>}

      {phase === 'ready' && data.flows.length === 0 && (
        <p className={css.empty}>{t('empty')}</p>
      )}

      {phase === 'ready' && data.flows.length > 0 && (
        <ul className={css.rows}>
          {data.flows.map(flow => (
            <li key={flow.key} className={css.rowCard}>
              <div className={css.rowLeft}>
                {renderLogo(flow.key, flow.label)}
                <div className={css.rowMain}>
                  <span className={css.rowLabel}>{flow.label}</span>
                  <span className={css.rowMeta}>
                    {flow.methods.map(entry => (
                      <span key={entry.id} className={css.methodChip}>{methodLabel(entry.id, t)}</span>
                    ))}
                    <span className={flow.configured ? css.badgeOn : css.badgeOff}>
                      {flow.configured ? t('connected') : t('notConnected')}
                    </span>
                    {flow.docsUrl !== undefined && (
                      <a className={css.docsLink} href={flow.docsUrl} target="_blank" rel="noreferrer">
                        {t('docs')}
                      </a>
                    )}
                  </span>
                </div>
              </div>
              <div className={css.rowActions}>
                {!flow.configured && (
                  <Button variant="primary" size="sm" disabled={flow.inFlight} onClick={() => { setConnectFlow(flow) }}>
                    {t('connect')}
                  </Button>
                )}
                {flow.configured && confirming?.key !== flow.key && (
                  <Button variant="outline" size="sm" onClick={() => { setConfirming(flow) }}>
                    {t('disconnect')}
                  </Button>
                )}
                {confirming?.key === flow.key && (
                  <>
                    <span className={css.confirmText}>{t('disconnectTitle').replace('{label}', flow.label)}</span>
                    <Button variant="ghost" size="sm" onClick={() => { setConfirming(undefined) }}>
                      {t('cancel')}
                    </Button>
                    <Button variant="primary" size="sm" disabled={disconnecting} onClick={() => { void runDisconnect(flow) }}>
                      {disconnecting ? t('connecting') : t('disconnectConfirm')}
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {phase === 'ready' && (
        <section className={css.mcpCard}>
          <h3 className={css.mcpTitle}>{t('mcpTitle')}</h3>
          <p className={css.mcpIntro}>{t('mcpIntro')}</p>
          {data.mcp.length === 0 && <p className={css.empty}>{t('mcpNone')}</p>}
          {data.mcp.length > 0 && (
            <ul className={css.rows}>
              {data.mcp.map(server => (
                <li key={server.serverName} className={css.rowCard}>
                  <div className={css.rowMain}>
                    <span className={css.rowLabel}>{server.serverName}</span>
                    <span className={css.rowMeta}>
                      <span className={server.state === 'ready' ? css.badgeOn : css.badgeOff}>
                        {mcpStatusLabel(server, t)}
                      </span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <ConnectDialog
        open={connectFlow !== undefined}
        flow={connectFlow}
        connections={connections}
        t={t}
        onClose={() => { setConnectFlow(undefined) }}
        onConnected={() => { setConnectFlow(undefined); void load() }}
      />
    </div>
  )
}
