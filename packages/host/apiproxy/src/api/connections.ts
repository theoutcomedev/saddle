/**
 * connections domain contract: the web face of the authorization seam
 * (ctx.authorization) plus live MCP server status. Flows registered on the
 * host (the shipped catalog, the on-demand request_credential tool) appear
 * here with their credential state; a connect starts one authorization
 * attempt whose prompts and notices the client walks step by step through
 * poll/answer, so the same seam the chat uses powers the settings page.
 */

import type { RpcRequest, RpcResponse } from './rpc.ts'

/** One method a flow offers (api-key, device, oauth). */
export interface ConnectionMethodView {
  /** Flow-owned id, echoed back when a caller picks this method. */
  id: string
  /** User-facing label for a picker. */
  label: string
}

/** One named field an api-key flow asks for. */
export interface ConnectionFieldView {
  /** Stable field id, stored keyed in the committed record. */
  id: string
  /** User-facing field label (e.g. Account SID, Auth Token). */
  label: string
  /** Masked-into-a-secret presentation. */
  secret?: boolean
}

/** One registered service flow as a surface shows it. */
export interface ConnectionFlowView {
  /** The credential record this flow writes, as scope/id. */
  key: string
  /** User-facing service name. */
  label: string
  /** The methods this flow offers, most preferred first. */
  methods: readonly ConnectionMethodView[]
  /** Whether a credential record for this flow is stored. */
  configured: boolean
  /** Whether an attempt for this key is running right now. */
  inFlight: boolean
  /** Provider page to get the credential, when the flow knows one. */
  docsUrl?: string
  /** The named fields an api-key flow asks for; absent for a single-secret flow. */
  fields?: readonly ConnectionFieldView[]
}

/** One prompt the running flow needs answered. */
export interface ConnectionPromptView {
  /** Attempt-local prompt id; answer() echoes it back. */
  id: string
  /** Presentation kind: secret is masked and kept out of logs. */
  kind: 'text' | 'secret' | 'select'
  /** What to ask. */
  message: string
  /** Choices for a select prompt. */
  options?: { id: string; label: string; description?: string }[]
}

/** One notice the running flow reported. */
export interface ConnectionNoticeView {
  /** What is happening, or what the human must do next. */
  message: string
  /** A page the human must open to continue. */
  url?: string
  /** A short code the human must enter on that page. */
  code?: string
}

/** The walkable state of one connect attempt. */
export type ConnectionAttemptState =
  | { state: 'connecting' }
  | { state: 'prompt'; prompt: ConnectionPromptView }
  | { state: 'notice'; notice: ConnectionNoticeView }
  | { state: 'settled'; status: 'authorized' | 'cancelled' }
  | { state: 'failed'; message: string }

/** One mounted MCP server's connection state. */
export interface McpServerView {
  /** The serverName namespace the instance owns. */
  serverName: string
  /** Coarse lifecycle state; closed means the instance is gone. */
  state: 'connecting' | 'ready' | 'failed' | 'closed'
  /** The failure text, present only when state is failed. */
  error?: string
}

/** connections.list response value. */
export interface ConnectionsListValue {
  /** Every registered flow, in registration order. */
  flows: ConnectionFlowView[]
  /** Every mounted MCP server's live status (empty when none are mounted). */
  mcp: McpServerView[]
}

/** Connections-domain unary methods (the map keys connections.* of RpcMethodMap). */
export interface ConnectionsApi {
  /**
   * List every registered authorization flow with its credential state, plus
   * the live status of every mounted MCP server.
   */
  list(request: RpcRequest<{}>): Promise<RpcResponse<ConnectionsListValue>>
  /**
   * Start one authorization attempt for a registered flow and method. The
   * attempt runs in the background; poll() walks its prompts and notices and
   * answer() feeds each prompt. Unknown keys are connection-not-found.
   */
  connect(request: RpcRequest<{ key: string; method?: string }>): Promise<RpcResponse<{ attemptId: string }>>
  /**
   * Read the current walkable state of one attempt: what it is waiting on, or
   * how it settled. Unknown or stale attempt ids are connection-attempt-invalid.
   */
  poll(request: RpcRequest<{ attemptId: string }>): Promise<RpcResponse<ConnectionAttemptState>>
  /**
   * Answer the prompt an attempt is currently waiting on. Answering a prompt
   * that is not pending is connection-attempt-invalid.
   */
  answer(request: RpcRequest<{ attemptId: string; value: string }>): Promise<RpcResponse<{}>>
  /**
   * Withdraw a connect attempt: its signal aborts, and the next poll reports
   * it settled as cancelled. Unknown attempt ids are connection-attempt-invalid.
   */
  cancel(request: RpcRequest<{ attemptId: string }>): Promise<RpcResponse<{}>>
  /**
   * Delete the stored credential record for one flow (the disconnect half of
   * a connection). Unknown keys are connection-not-found; an absent record
   * is idempotent.
   */
  disconnect(request: RpcRequest<{ key: string }>): Promise<RpcResponse<{}>>
  /**
   * Add a user-defined api-key service and register its flow. The definition
   * persists (survives restarts); a duplicate label gets a suffixed id.
   */
  registerCustom(
    request: RpcRequest<{ label: string; docsUrl?: string; fields?: { label: string }[] }>,
  ): Promise<RpcResponse<{ key: string }>>
}
