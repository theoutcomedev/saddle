/**
 * connections domain zod schemas (names derived from map keys:
 * connectionsListRequestSchema / connectionsListValueSchema / …).
 * The credential-key pattern mirrors the seam's credentialKey guard so an
 * invalid key fails as bad-request before reaching the service.
 */

import { z } from 'zod'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'
import type {
  ConnectionAttemptState, ConnectionFieldView, ConnectionFlowView, ConnectionMethodView,
  ConnectionNoticeView, ConnectionPromptView, ConnectionsListValue, McpServerView,
} from './connections.ts'

/** A scope/id credential-key string (the seam's two lowercase-hyphenated segments). */
export const connectionKeySchema = z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/)

/** One connection method of a flow. */
export const connectionMethodViewSchema = z.object({
  id: z.string(),
  label: z.string(),
}) satisfies z.ZodType<Wire<ConnectionMethodView>>

/** One named field an api-key flow asks for. */
export const connectionFieldViewSchema = z.object({
  id: z.string(),
  label: z.string(),
  secret: z.boolean().optional(),
}) satisfies z.ZodType<Wire<ConnectionFieldView>>

/** One registered flow as a surface shows it. */
export const connectionFlowViewSchema = z.object({
  key: connectionKeySchema,
  label: z.string(),
  methods: z.array(connectionMethodViewSchema),
  configured: z.boolean(),
  inFlight: z.boolean(),
  docsUrl: z.string().optional(),
  getKeyUrl: z.string().optional(),
  fields: z.array(connectionFieldViewSchema).optional(),
}) satisfies z.ZodType<Wire<ConnectionFlowView>>

/** One prompt the running flow needs answered. */
export const connectionPromptViewSchema = z.object({
  id: z.string(),
  kind: z.enum(['text', 'secret', 'select']),
  message: z.string(),
  options: z.array(z.object({ id: z.string(), label: z.string(), description: z.string().optional() })).optional(),
}) satisfies z.ZodType<Wire<ConnectionPromptView>>

/** One notice the running flow reported. */
export const connectionNoticeViewSchema = z.object({
  message: z.string(),
  url: z.string().optional(),
  code: z.string().optional(),
}) satisfies z.ZodType<Wire<ConnectionNoticeView>>

/** The walkable state of one connect attempt. */
export const connectionAttemptStateSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('connecting') }),
  z.object({ state: z.literal('prompt'), prompt: connectionPromptViewSchema }),
  z.object({ state: z.literal('notice'), notice: connectionNoticeViewSchema }),
  z.object({ state: z.literal('settled'), status: z.enum(['authorized', 'cancelled']) }),
  z.object({ state: z.literal('failed'), message: z.string() }),
]) satisfies z.ZodType<Wire<ConnectionAttemptState>>

/** One mounted MCP server's connection state. */
export const mcpServerViewSchema = z.object({
  serverName: z.string(),
  state: z.enum(['connecting', 'ready', 'failed', 'closed']),
  error: z.string().optional(),
}) satisfies z.ZodType<Wire<McpServerView>>

/** connections.list request payload. */
export const connectionsListRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'connections.list'>>>

/** connections.list response value. */
export const connectionsListValueSchema = z.object({
  flows: z.array(connectionFlowViewSchema),
  mcp: z.array(mcpServerViewSchema),
}) satisfies z.ZodType<Wire<ConnectionsListValue>>

/** connections.connect request payload. */
export const connectionsConnectRequestSchema = z.object({
  key: connectionKeySchema,
  method: z.string().optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'connections.connect'>>>

/** connections.connect response value. */
export const connectionsConnectValueSchema = z.object({
  attemptId: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'connections.connect'>>>

/** connections.poll request payload. */
export const connectionsPollRequestSchema = z.object({
  attemptId: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'connections.poll'>>>

/** connections.poll response value. */
export const connectionsPollValueSchema = connectionAttemptStateSchema satisfies z.ZodType<Wire<ResponseValue<'connections.poll'>>>

/** connections.answer request payload. */
export const connectionsAnswerRequestSchema = z.object({
  attemptId: z.string().min(1),
  value: z.string(),
}) satisfies z.ZodType<Wire<RequestPayload<'connections.answer'>>>

/** connections.answer response value. */
export const connectionsAnswerValueSchema = z.object({}) satisfies z.ZodType<Wire<ResponseValue<'connections.answer'>>>

/** connections.cancel request payload. */
export const connectionsCancelRequestSchema = z.object({
  attemptId: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'connections.cancel'>>>

/** connections.cancel response value. */
export const connectionsCancelValueSchema = z.object({}) satisfies z.ZodType<Wire<ResponseValue<'connections.cancel'>>>

/** connections.disconnect request payload. */
export const connectionsDisconnectRequestSchema = z.object({
  key: connectionKeySchema,
}) satisfies z.ZodType<Wire<RequestPayload<'connections.disconnect'>>>

/** connections.registerCustom request payload. */
export const connectionsRegisterCustomRequestSchema = z.object({
  label: z.string().min(1),
  docsUrl: z.string().url().optional(),
  fields: z.array(z.object({ label: z.string().min(1) })).max(8).optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'connections.registerCustom'>>>

/** connections.registerCustom response value. */
export const connectionsRegisterCustomValueSchema = z.object({
  key: connectionKeySchema,
}) satisfies z.ZodType<Wire<ResponseValue<'connections.registerCustom'>>>

/** connections.disconnect response value. */
export const connectionsDisconnectValueSchema = z.object({}) satisfies z.ZodType<Wire<ResponseValue<'connections.disconnect'>>>
