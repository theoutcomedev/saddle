/**
 * The outward connections-service face — what ctx.connections exposes to
 * feature packages, and therefore exactly what the test runtime's connections
 * double must implement. Wire-pump entry points stay on the concrete class;
 * cross-domain consumers keep the narrower methods here. Widening this
 * interface is the explicit act of widening what features may do to the
 * connections domain.
 */
import type { RpcResult } from '@deepseek-ai/dsh-api-remotes/client'
import type {
  ConnectionAttemptState, ConnectionsListValue,
} from '@deepseek-ai/dsh-api-remotes/client'

/** The connections-service face injected as ctx.connections. */
export interface IConnections {
  /**
   * List every registered authorization flow with its credential state, plus
   * the live status of every mounted MCP server.
   * @returns the flows and MCP servers, or a business/transport error.
   */
  list(): Promise<RpcResult<ConnectionsListValue>>
  /**
   * Start one authorization attempt for a registered flow and method; the
   * attempt runs on the host and this returns its walkable id.
   * @param key - the flow's credential key (scope/id).
   * @param method - one of the flow's method ids; defaults to the first.
   * @returns the attempt id, or a business/transport error.
   */
  connect(key: string, method?: string): Promise<RpcResult<{ attemptId: string }>>
  /**
   * Read the current walkable state of one attempt: what it is waiting on, or
   * how it settled.
   * @param attemptId - the id returned by connect().
   * @returns the attempt state, or a business/transport error.
   */
  poll(attemptId: string): Promise<RpcResult<ConnectionAttemptState>>
  /**
   * Answer the prompt an attempt is currently waiting on.
   * @param attemptId - the id returned by connect().
   * @param value - the typed text or chosen option id.
   * @returns completion, or a business/transport error.
   */
  answer(attemptId: string, value: string): Promise<RpcResult<{}>>
  /**
   * Withdraw a connect attempt; the next poll reports it settled as cancelled.
   * @param attemptId - the id returned by connect().
   * @returns completion, or a business/transport error.
   */
  cancel(attemptId: string): Promise<RpcResult<{}>>
  /**
   * Delete the stored credential record for one flow (disconnect).
   * @param key - the flow's credential key (scope/id).
   * @returns completion, or a business/transport error.
   */
  disconnect(key: string): Promise<RpcResult<{}>>
}
