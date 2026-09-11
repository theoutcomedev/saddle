/**
 * schedules domain zod schemas (schedulesListRequestSchema / schedulesListValueSchema / etc.).
 */

import { z } from 'zod'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'
import type { ScheduledTaskView, TaskRunLogEntry } from './schedules.ts'

/** ScheduledTaskView row. */
export const scheduledTaskViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  prompt: z.string(),
  cadenceType: z.enum(['cron', 'interval', 'once']),
  cadenceValue: z.string(),
  cadenceLabel: z.string(),
  enabled: z.boolean(),
  targetMode: z.enum(['new-session', 'current-session']),
  sessionId: z.string().optional(),
  workspacePath: z.string().optional(),
  createdAt: z.string(),
  lastRunAt: z.string().optional(),
  lastStatus: z.enum(['success', 'failed', 'running']).optional(),
  lastError: z.string().optional(),
  nextRunAt: z.string().optional(),
}) satisfies z.ZodType<Wire<ScheduledTaskView>>

/** TaskRunLogEntry row. */
export const taskRunLogEntrySchema = z.object({
  id: z.string(),
  taskId: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  status: z.enum(['success', 'failed', 'running']),
  sessionId: z.string().optional(),
  outputSnippet: z.string().optional(),
  error: z.string().optional(),
}) satisfies z.ZodType<Wire<TaskRunLogEntry>>

/** schedules.list request payload. */
export const schedulesListRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'schedules.list'>>>

/** schedules.list response value. */
export const schedulesListValueSchema = z.object({
  tasks: z.array(scheduledTaskViewSchema),
}) satisfies z.ZodType<Wire<ResponseValue<'schedules.list'>>>

/** schedules.create request payload. */
export const schedulesCreateRequestSchema = z.object({
  name: z.string().min(1),
  prompt: z.string().min(1),
  cadenceType: z.enum(['cron', 'interval', 'once']),
  cadenceValue: z.string().min(1),
  targetMode: z.enum(['new-session', 'current-session']).optional(),
  sessionId: z.string().optional(),
  workspacePath: z.string().optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'schedules.create'>>>

/** schedules.create response value. */
export const schedulesCreateValueSchema = z.object({
  task: scheduledTaskViewSchema,
}) satisfies z.ZodType<Wire<ResponseValue<'schedules.create'>>>

/** schedules.update request payload. */
export const schedulesUpdateRequestSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  prompt: z.string().optional(),
  cadenceType: z.enum(['cron', 'interval', 'once']).optional(),
  cadenceValue: z.string().optional(),
  enabled: z.boolean().optional(),
  targetMode: z.enum(['new-session', 'current-session']).optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'schedules.update'>>>

/** schedules.update response value. */
export const schedulesUpdateValueSchema = z.object({
  task: scheduledTaskViewSchema,
}) satisfies z.ZodType<Wire<ResponseValue<'schedules.update'>>>

/** schedules.delete request payload. */
export const schedulesDeleteRequestSchema = z.object({
  id: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'schedules.delete'>>>

/** schedules.delete response value. */
export const schedulesDeleteValueSchema = z.object({
  success: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'schedules.delete'>>>

/** schedules.trigger request payload. */
export const schedulesTriggerRequestSchema = z.object({
  id: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'schedules.trigger'>>>

/** schedules.trigger response value. */
export const schedulesTriggerValueSchema = z.object({
  runId: z.string(),
  status: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'schedules.trigger'>>>

/** schedules.logs request payload. */
export const schedulesLogsRequestSchema = z.object({
  taskId: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'schedules.logs'>>>

/** schedules.logs response value. */
export const schedulesLogsValueSchema = z.object({
  runs: z.array(taskRunLogEntrySchema),
}) satisfies z.ZodType<Wire<ResponseValue<'schedules.logs'>>>
