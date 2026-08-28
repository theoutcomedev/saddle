/**
 * apps domain contract: API for discovering, monitoring, and managing deployed web applications.
 */

import type { RpcRequest, RpcResponse } from './rpc.ts'

/** Representation of one deployed containerized web application. */
export interface DeployedAppView {
  /** Container identifier or name (e.g. app-saypixels). */
  id: string
  /** Human-readable app name (e.g. saypixels). */
  name: string
  /** Active lifecycle state: running, restarting, paused, stopped. */
  status: 'running' | 'restarting' | 'paused' | 'stopped'
  /** Live public URL (e.g. http://saypixels.91.99.165.95.sslip.io/). */
  url: string
  /** Port exposed by the application container. */
  port?: number | undefined
  /** Docker image used by the container. */
  image?: string | undefined
  /** Human-readable uptime (e.g. Up 2 hours). */
  uptime?: string | undefined
  /** ISO timestamp when the container was created. */
  createdAt?: string | undefined
}

/** Apps domain unary methods (POST /api/apps.* of RpcMethodMap). */
export interface AppsApi {
  /** List all active and stopped applications discovered on saddle-network. */
  list(request: RpcRequest<{}>): Promise<RpcResponse<{ apps: DeployedAppView[] }>>

  /** Restart a deployed application container. */
  restart(request: RpcRequest<{ name: string }>): Promise<RpcResponse<{ success: boolean; message?: string }>>

  /** Stop a running application container. */
  stop(request: RpcRequest<{ name: string }>): Promise<RpcResponse<{ success: boolean; message?: string }>>

  /** Delete and remove a deployed application container. */
  delete(request: RpcRequest<{ name: string }>): Promise<RpcResponse<{ success: boolean; message?: string }>>

  /** Fetch the recent logs from the application container. */
  logs(request: RpcRequest<{ name: string; tail?: number }>): Promise<RpcResponse<{ logs: string }>>
}
