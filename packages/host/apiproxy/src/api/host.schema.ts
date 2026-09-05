/**
 * host domain zod schemas (names derived from map keys).
 */

import { z } from 'zod'
import type { DirectoryEntry, WorkspaceFileEntry } from './host.ts'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'

/** host.describe request payload (empty object literal). */
export const hostDescribeRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'host.describe'>>>

/** host.describe response value. */
export const hostDescribeValueSchema = z.object({
  version: z.string(),
  cwd: z.string(),
  provider: z.string().optional(),
  model: z.string().optional(),
  attachedSessions: z.number().int().nonnegative(),
  home: z.string(),
  canOpenPath: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.describe'>>>

/** host.pickDirectory request payload (empty object literal). */
export const hostPickDirectoryRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'host.pickDirectory'>>>

/** host.pickDirectory response value; null means the user cancelled. */
export const hostPickDirectoryValueSchema = z.object({
  path: z.string().nullable(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.pickDirectory'>>>

/** Directory row shared by listing entries and breadcrumb crumbs. */
export const directoryEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  hidden: z.boolean(),
}) satisfies z.ZodType<Wire<DirectoryEntry>>

/** host.listDirectory request payload; an absent path lists the home directory. */
export const hostListDirectoryRequestSchema = z.object({
  path: z.string().optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.listDirectory'>>>

/** host.listDirectory response value. */
export const hostListDirectoryValueSchema = z.object({
  path: z.string(),
  home: z.string(),
  crumbs: z.array(directoryEntrySchema),
  entries: z.array(directoryEntrySchema),
  truncated: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.listDirectory'>>>

/** host.createDirectory request payload: name must be one plain path segment. */
export const hostCreateDirectoryRequestSchema = z.object({
  path: z.string(),
  name: z.string(),
}).refine(
  payload => payload.name.trim() !== '' && payload.name !== '.' && payload.name !== '..'
    && !/[/\\]/.test(payload.name),
  { message: 'host.createDirectory requires a single non-blank path segment name' },
) satisfies z.ZodType<Wire<RequestPayload<'host.createDirectory'>>>

/** host.createDirectory response value: the created directory's absolute path. */
export const hostCreateDirectoryValueSchema = z.object({
  path: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.createDirectory'>>>
/** host.openPath request payload. */
export const hostOpenPathRequestSchema = z.object({
  path: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'host.openPath'>>>

/** host.openPath response value. */
export const hostOpenPathValueSchema = z.object({
  opened: z.literal(true),
}) satisfies z.ZodType<Wire<ResponseValue<'host.openPath'>>>

/** One entry in a host.listFiles response. */
export const workspaceFileEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  isDir: z.boolean(),
  hidden: z.boolean(),
  sizeBytes: z.number().optional(),
}) satisfies z.ZodType<Wire<WorkspaceFileEntry>>

/** host.listFiles request payload. */
export const hostListFilesRequestSchema = z.object({ path: z.string() }) satisfies z.ZodType<Wire<RequestPayload<'host.listFiles'>>>

/** host.listFiles response value. */
export const hostListFilesValueSchema = z.object({
  path: z.string(),
  entries: z.array(workspaceFileEntrySchema),
  truncated: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.listFiles'>>>

/** host.readFile request payload. */
export const hostReadFileRequestSchema = z.object({ path: z.string() }) satisfies z.ZodType<Wire<RequestPayload<'host.readFile'>>>

/** host.readFile response value. */
export const hostReadFileValueSchema = z.object({
  path: z.string(),
  text: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.readFile'>>>

/** host.writeFile request payload. */
export const hostWriteFileRequestSchema = z.object({
  path: z.string(),
  content: z.string(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.writeFile'>>>

/** host.writeFile response value. */
export const hostWriteFileValueSchema = z.object({
  path: z.string(),
  bytesWritten: z.number(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.writeFile'>>>

/** host.deletePaths request payload. */
export const hostDeletePathsRequestSchema = z.object({
  paths: z.array(z.string()),
}) satisfies z.ZodType<Wire<RequestPayload<'host.deletePaths'>>>

/** host.deletePaths response value. */
export const hostDeletePathsValueSchema = z.object({
  deleted: z.array(z.string()),
}) satisfies z.ZodType<Wire<ResponseValue<'host.deletePaths'>>>

/** host.createFile request payload. */
export const hostCreateFileRequestSchema = z.object({
  path: z.string(),
  content: z.string().optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.createFile'>>>

/** host.createFile response value. */
export const hostCreateFileValueSchema = z.object({
  path: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.createFile'>>>

/** host.renamePath request payload. */
export const hostRenamePathRequestSchema = z.object({
  oldPath: z.string(),
  newPath: z.string(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.renamePath'>>>

/** host.renamePath response value. */
export const hostRenamePathValueSchema = z.object({
  path: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.renamePath'>>>
