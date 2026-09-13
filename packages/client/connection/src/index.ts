/** Host HTTP bridge for browser-client RPC. */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-attachment'
// Activates the webServer Context merge used below.
import type { WebRoute, WebUpgradeRoute } from '@deepseek-ai/dsh-host-webserver'
import { toFetchHandler } from '@deepseek-ai/dsh-host-apiproxy'
import { API_PATH, HOST_EVENTS_PATH, MUX_EVENTS_PATH } from './api-path.ts'
import { bridge, DEFAULT_MAX_REQUEST_BODY_BYTES } from './http-bridge.ts'
import { assertTrustedAuthority, isTrustedApiRequest } from './api-request-trust.ts'
import { HostConnectionService } from './rpc-host.ts'
import { rejectWebSocketUpgrade, WebSocketDownlinks } from './websocket-downlink.ts'

export type {
  ConnectionRpcAuthority,
  ConnectionRpcEndpointMatcher,
  ConnectionRpcHandler,
  ConnectionRpcHandlerOptions,
  HostConnectionHandle,
  HostConnectionRpc,
} from './rpc.ts'
export { HostConnectionService } from './rpc-host.ts'

export { API_PATH, HOST_EVENTS_PATH, MUX_EVENTS_PATH } from './api-path.ts'

/** Stable Cordis plugin name. */
export const name = 'client-connection'

/** Headroom for RPC JSON fields around aggregate base64 image payloads. */
const REQUEST_ENVELOPE_HEADROOM_BYTES = 1024 * 1024

/**
 * Largest model-discovery payload that may be inspected for an endpoint. A
 * discovery draft is a handful of short strings; a body declared larger than
 * this is refused rather than copied for the check.
 */
const MAX_DISCOVERY_PROBE_BYTES = 64 * 1024

/**
 * Whether one `llm.discoverModels` request can leave the host at all.
 *
 * The pinned half of this method is the one carrying an endpoint: the adapter
 * asks the HOST to GET a URL the caller chose — with the route's stored
 * credential attached — and reports what it saw, which is a probe for anything
 * the host can reach and the browser cannot. A request naming no endpoint never
 * gets there: the adapter answers from its installed catalog or refuses before
 * any fetch, and it resolves the stored credential only past that point.
 * @param request - the buffered /api request, envelope included.
 * @returns true when the payload names no endpoint for the host to fetch.
 */
async function discoveryWithoutEndpoint(request: Request): Promise<boolean> {
  const declared = Number(request.headers.get('content-length') ?? '0')
  // A chunked body declares nothing; it stays bounded by the bridge's own
  // buffering cap instead of being refused here.
  if (Number.isFinite(declared) && declared > MAX_DISCOVERY_PROBE_BYTES) return false
  try {
    const envelope: unknown = await request.clone().json()
    if (typeof envelope !== 'object' || envelope === null) return false
    const payload = (envelope as { payload?: unknown }).payload
    const endpoint = (value: unknown): unknown =>
      typeof value === 'object' && value !== null ? (value as { baseURL?: unknown }).baseURL : undefined
    // Either spelling of the draft counts as carrying one: the check refuses,
    // it never grants.
    for (const baseURL of [endpoint(payload), endpoint(envelope)]) {
      if (typeof baseURL === 'string' && baseURL.length > 0) return false
    }
    return true
  } catch {
    // An unreadable body is not evidence that it is harmless.
    return false
  }
}

function assertImageBodyCapacity(ctx: Context, maxRequestBodyBytes: number): void {
  const attachments = ctx.get('attachments')
  if (attachments === undefined) return
  const requiredImageBodyBytes = Math.ceil(
    attachments.imageLimits.maxMessageImageBytes * 4 / 3,
  ) + REQUEST_ENVELOPE_HEADROOM_BYTES
  if (maxRequestBodyBytes < requiredImageBodyBytes) {
    throw new Error(
      `client-connection maxRequestBodyBytes (${String(maxRequestBodyBytes)}) must be at least `
      + `${String(requiredImageBodyBytes)} for the configured aggregate image limit`,
    )
  }
}

/** Services required before providing Connection; API Proxy is an optional `/api` fallback. */
export const inject = ['webServer']

/** Plugin config: the deployment's non-loopback serving authorities. */
export interface ConnectionConfig {
  /**
   * Authorities this deployment serves beyond loopback: exact `host:port`, or
   * port-less `host` matching any port. The /api trust fence refuses any
   * request whose Host is neither loopback nor listed here, so a
   * non-loopback (`0.0.0.0`) deployment must declare the names it is reached
   * by (the dsh CLI derives the machine's LAN IP literals itself). An entry
   * that is not a bare, canonical authority fails the plugin load.
   */
  trustedHosts?: string[]
  /** Maximum buffered JSON body for every `/api` request. Default: 300 MiB. */
  maxRequestBodyBytes?: number
}

export const Config: z<ConnectionConfig> = z.object({
  trustedHosts: z.array(String).default([]),
  maxRequestBodyBytes: z.natural().min(1).default(DEFAULT_MAX_REQUEST_BODY_BYTES),
})

/**
 * Methods gated to loopback even on a trusted-host deployment: the ones whose
 * meaning is inseparable from the host machine, or whose reply is a reading of
 * what the host can reach.
 *
 * Native dialogs and openers (`host.pickDirectory`, `host.openPath`,
 * `agentPreset.openDocument`) act on the SERVER's desktop. A remote caller
 * asking to open a path means "show it to me", which the Workbench pane already
 * does; acting on the host instead is never what they meant.
 * `llm.discoverModels` makes the HOST issue a GET to a URL the caller chose and
 * reports the status or the parsed body back, so a non-loopback caller would
 * hold a probe for everything the host can reach and their browser cannot. Only
 * that half is pinned: a discovery request naming no endpoint is answered from
 * the installed catalog inside this process, so a deployment may ask for its
 * model list from its own origin (see {@link discoveryWithoutEndpoint}).
 *
 * The configuration plane (`settings.*`, `credentials.*`, `agentPreset.read`,
 * `agentPreset.copy`, `agentPreset.remove`) is deliberately NOT here: this
 * deployment is configured from its public origin, and authentication — the
 * admin password on every request — is the gate that replaces the loopback
 * assumption `trustedHosts` never was. The model catalog
 * (`llm.providers`, `llm.models`) stays reachable for the same reason.
 */
const PRIVILEGED_METHODS = new Set<string>([
  'host.pickDirectory',
  'host.openPath',
  'agentPreset.openDocument',
  'llm.discoverModels',
])

/**
 * Mounts the API gateway under the browser transport prefix. Every request on
 * the prefix passes the browser-trust fence first (DNS-rebinding and
 * cross-site defense — [api-request-trust](./api-request-trust.ts));
 * privileged methods additionally pass it with an empty trust list, which
 * pins them to loopback.
 * @param ctx - Host plugin context.
 * @param config - resolved plugin config (schema defaults applied).
 */
export function apply(ctx: Context, config?: ConnectionConfig): void {
  // The Loader resolves schema defaults; hand-built test contexts may pass none.
  const trustedHosts = config?.trustedHosts ?? []
  const maxRequestBodyBytes = config?.maxRequestBodyBytes ?? DEFAULT_MAX_REQUEST_BODY_BYTES
  // Config boundary: a malformed entry fails the load loudly here rather than
  // silently authorizing its hostname prefix at request time.
  for (const entry of trustedHosts) assertTrustedAuthority(entry)
  if (ctx.get('apiProxy') !== undefined) assertImageBodyCapacity(ctx, maxRequestBodyBytes)
  const connection = new HostConnectionService(ctx, trustedHosts)
  const fetchHandler = connection.createSharedFetchHandler(API_PATH, {
    async fetch(request) {
      const pathname = new URL(request.url).pathname
      const method = pathname.startsWith(`${API_PATH}/`)
        ? pathname.slice(API_PATH.length + 1)
        : undefined
      if (method !== undefined
        && PRIVILEGED_METHODS.has(method)
        && !isTrustedApiRequest(request, [])) {
        // Discovery splits along its own payload: the catalog half is a read of
        // this process's registry, the endpoint half is a fetch this host makes
        // on the caller's behalf.
        const catalogRead = method === 'llm.discoverModels' && await discoveryWithoutEndpoint(request)
        if (!catalogRead) return new Response('forbidden', { status: 403 })
      }
      if (request.method === 'GET' && (pathname === MUX_EVENTS_PATH || pathname === HOST_EVENTS_PATH)) {
        return new Response('upgrade required', {
          status: 426,
          headers: { connection: 'Upgrade', upgrade: 'websocket' },
        })
      }
      const apiProxy = ctx.get('apiProxy')
      if (apiProxy === undefined) return new Response('not found', { status: 404 })
      return toFetchHandler(apiProxy).fetch(request)
    },
  })
  const route: WebRoute = {
    kind: 'prefix',
    path: API_PATH,
    handler: async (req, res) => {
      if (!isTrustedApiRequest(req, trustedHosts)) {
        res.writeHead(403)
        res.end('forbidden')
        return
      }
      await bridge(req, res, fetchHandler, maxRequestBodyBytes)
    },
  }
  ctx.effect(() => ctx.webServer.register(route), 'client-connection: /api route')
  ctx.inject(['apiProxy'], (apiCtx) => {
    assertImageBodyCapacity(apiCtx, maxRequestBodyBytes)
    const downlinks = new WebSocketDownlinks(apiCtx.apiProxy)
    const registerDownlink = (
      path: string,
      handle: WebUpgradeRoute['handler'],
    ): void => {
      apiCtx.effect(() => apiCtx.webServer.registerUpgrade({
        path,
        handler: (req, socket, head) => {
          if (!isTrustedApiRequest(req, trustedHosts)) {
            rejectWebSocketUpgrade(socket)
            return
          }
          return handle(req, socket, head)
        },
      }), `client-connection: ${path} WebSocket`)
    }
    apiCtx.effect(() => () => downlinks.close(), 'client-connection: WebSocket downlinks')
    registerDownlink(MUX_EVENTS_PATH, (req, socket, head) => { downlinks.handleMux(req, socket, head) })
    registerDownlink(HOST_EVENTS_PATH, (req, socket, head) => { downlinks.handleHost(req, socket, head) })
  })
}
