/**
 * apps domain zod schemas (appsListRequestSchema / appsListValueSchema / etc.).
 */

import { z } from 'zod'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'
import type { DeployedAppView } from './apps.ts'

/** DeployedAppView row. */
export const deployedAppViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['running', 'restarting', 'paused', 'stopped']),
  url: z.string(),
  port: z.number().optional(),
  image: z.string().optional(),
  uptime: z.string().optional(),
  createdAt: z.string().optional(),
}) satisfies z.ZodType<Wire<DeployedAppView>>

/** apps.list request payload. */
export const appsListRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'apps.list'>>>

/** apps.list response value. */
export const appsListValueSchema = z.object({
  apps: z.array(deployedAppViewSchema),
}) satisfies z.ZodType<Wire<ResponseValue<'apps.list'>>>

/** apps.restart request payload. */
export const appsRestartRequestSchema = z.object({
  name: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'apps.restart'>>>

/** apps.restart response value. */
export const appsRestartValueSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
}) satisfies z.ZodType<Wire<ResponseValue<'apps.restart'>>>

/** apps.stop request payload. */
export const appsStopRequestSchema = z.object({
  name: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'apps.stop'>>>

/** apps.stop response value. */
export const appsStopValueSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
}) satisfies z.ZodType<Wire<ResponseValue<'apps.stop'>>>

/** apps.delete request payload. */
export const appsDeleteRequestSchema = z.object({
  name: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'apps.delete'>>>

/** apps.delete response value. */
export const appsDeleteValueSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
}) satisfies z.ZodType<Wire<ResponseValue<'apps.delete'>>>

/** apps.logs request payload. */
export const appsLogsRequestSchema = z.object({
  name: z.string().min(1),
  tail: z.number().optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'apps.logs'>>>

/** apps.logs response value. */
export const appsLogsValueSchema = z.object({
  logs: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'apps.logs'>>>
