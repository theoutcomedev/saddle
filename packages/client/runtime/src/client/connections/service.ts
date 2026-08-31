/**
 * ConnectionsRuntime: the thin data-object-layer face over the connections
 * wire domain. It owns no state — the host owns every attempt — so the
 * settings surface drives its own walk from these methods and local state.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { IApiClient, RpcResult } from '@deepseek-ai/dsh-api-remotes/client'
import type {
  ConnectionAttemptState, ConnectionsListValue,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { IConnections } from '../contract/connections.ts'

/** The connections service: request/response walk over the host attempts. */
export class ConnectionsRuntime implements IConnections {
  /**
   * @param ctx - client root context (provides ctx.connections).
   * @param api - shared wire client.
   */
  constructor(ctx: Context, private readonly api: IApiClient) {
    ctx.reflect.provide('connections', this, undefined)
  }

  async list(): Promise<RpcResult<ConnectionsListValue>> {
    return (await this.api.connections.list({})).result
  }

  async connect(key: string, method?: string): Promise<RpcResult<{ attemptId: string }>> {
    return (await this.api.connections.connect(method === undefined ? { key } : { key, method })).result
  }

  async poll(attemptId: string): Promise<RpcResult<ConnectionAttemptState>> {
    return (await this.api.connections.poll({ attemptId })).result
  }

  async answer(attemptId: string, value: string): Promise<RpcResult<{}>> {
    return (await this.api.connections.answer({ attemptId, value })).result
  }

  async cancel(attemptId: string): Promise<RpcResult<{}>> {
    return (await this.api.connections.cancel({ attemptId })).result
  }

  async disconnect(key: string): Promise<RpcResult<{}>> {
    return (await this.api.connections.disconnect({ key })).result
  }

  async registerCustom(input: { label: string; docsUrl?: string; fields?: { label: string }[] }): Promise<RpcResult<{ key: string }>> {
    return (await this.api.connections.registerCustom(input)).result
  }
}
